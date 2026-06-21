use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, watch, Mutex};

use super::commands::{CmdResult, CommandEvent, MobileAction, Origin, PendingMap, ACK_TIMEOUT};
use super::frame::{read_frame, write_frame, NOISE_MAX};
use super::identity::Identity;
use super::snapshot::{self, Snapshot};
use super::tokens::TokenStore;
use super::{noise_params, BridgeError};

// Server -> client opcodes.
const OP_HELLO: u8 = 0x01;
const OP_SNAPSHOT_BEGIN: u8 = 0x02;
const OP_SNAPSHOT_CHUNK: u8 = 0x03;
const OP_SNAPSHOT_END: u8 = 0x04;
const OP_PING: u8 = 0x07;
const OP_ACK: u8 = 0x08;
/// Result of a read-only mobile query (e.g. the provider/model menu). Distinct
/// from OP_ACK so the phone routes it to a data continuation, not the
/// write-command ACK handler.
const OP_QUERY_RESULT: u8 = 0x0A;
// Client -> server opcodes.
const OP_PONG: u8 = 0x80;
const OP_SUBSCRIBE: u8 = 0x81;
const OP_RESNAPSHOT: u8 = 0x82;
// Client -> server WRITE opcodes (0x83..=0x86) are decoded via
// `MobileAction::from_opcode`; the closed set lives in `commands.rs`.

const PING_INTERVAL: Duration = Duration::from_secs(20);
/// How often the bridge checks the DB for changes to auto-push to the phone.
/// Doubles as a debounce: at most one snapshot push per interval even under a
/// burst of writes (e.g. streaming turn events).
const SYNC_POLL_INTERVAL: Duration = Duration::from_secs(2);

/// Shared handles the per-connection task needs.
pub struct ServerCtx {
    pub identity: Arc<Mutex<Identity>>,
    pub tokens: Arc<TokenStore>,
    pub device_name: String,
    /// Used to forward mobile commands to the trusted frontend executor.
    pub app: AppHandle,
    /// In-flight mobile commands awaiting a frontend result.
    pub pending: PendingMap,
    /// Tripped (or dropped) when the bridge stops or revokes; every live
    /// connection bails at once so a forgotten phone cannot keep observing or
    /// sending commands.
    pub shutdown: watch::Receiver<bool>,
}

/// Accepts connections until `listener` is dropped (bridge stop drops the task).
pub async fn serve(listener: TcpListener, ctx: Arc<ServerCtx>) {
    loop {
        match listener.accept().await {
            Ok((stream, _peer)) => {
                let ctx = ctx.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_conn(stream, ctx).await {
                        log::warn!("[bridge] connection ended: {e}");
                    }
                });
            }
            Err(e) => {
                log::warn!("[bridge] accept failed: {e}");
                return;
            }
        }
    }
}

async fn handle_conn(mut stream: TcpStream, ctx: Arc<ServerCtx>) -> Result<(), BridgeError> {
    // ---- Noise_XK responder handshake ----
    let static_priv = { ctx.identity.lock().await.static_priv()? };
    let mut hs = snow::Builder::new(noise_params())
        .local_private_key(&static_priv)
        .build_responder()
        .map_err(|e| BridgeError::Noise(e.to_string()))?;

    let mut scratch = vec![0u8; NOISE_MAX];

    // msg1: -> e, es  (payload = enrollment token, or empty for re-dial)
    let msg1 = read_frame(&mut stream).await?;
    let n = hs
        .read_message(&msg1, &mut scratch)
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    let msg1_payload = scratch[..n].to_vec();

    let enrolling = match msg1_payload.len() {
        0 => false,
        32 => {
            if !ctx.tokens.consume(&msg1_payload) {
                return Err(BridgeError::Unauthorized("invalid or expired token".into()));
            }
            true
        }
        other => {
            return Err(BridgeError::Protocol(format!(
                "msg1 payload must be 0 or 32 bytes, got {other}"
            )))
        }
    };

    // msg2: <- e, ee
    let len = hs
        .write_message(&[], &mut scratch)
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    write_frame(&mut stream, &scratch[..len]).await?;

    // msg3: -> s, se  (phone reveals its static)
    let msg3 = read_frame(&mut stream).await?;
    hs.read_message(&msg3, &mut scratch)
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    let phone_static = hs
        .get_remote_static()
        .ok_or_else(|| BridgeError::Protocol("missing phone static after msg3".into()))?
        .to_vec();

    // Authorize: enrollment adds to allow-list; re-dial requires membership.
    {
        let mut id = ctx.identity.lock().await;
        if enrolling {
            id.enroll(&phone_static)?;
        } else if !id.is_enrolled(&phone_static) {
            return Err(BridgeError::Unauthorized("phone not enrolled".into()));
        }
    }

    let mut transport = hs
        .into_transport_mode()
        .map_err(|e| BridgeError::Noise(e.to_string()))?;

    // ---- App layer: HELLO then the initial snapshot ----
    let snap = snapshot::build()?;
    send_app(
        &mut stream,
        &mut transport,
        OP_HELLO,
        &json!({
            "protocol": 1,
            "deviceName": ctx.device_name,
            "headMigration": snap.head_migration,
            "serverTime": now_iso(),
        }),
    )
    .await?;
    stream_snapshot(&mut stream, &mut transport, &snap).await?;
    log::info!("[bridge] phone synced; head {}", snap.head_migration);

    // A desktop stop/revoke trips this; the live loop bails at once. Catch the
    // already-shut-down case before entering the loop, then race it below.
    let mut shutdown = ctx.shutdown.clone();
    if *shutdown.borrow() {
        return Ok(());
    }

    // Live loop: PING heartbeat + DB-change auto-sync + handle client frames.
    let mut ping = tokio::time::interval(PING_INTERVAL);
    ping.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    // Auto-sync: poll the DB's data_version and push a fresh snapshot when the
    // desktop writes, so the phone stays current without manual pull-to-refresh.
    // If the probe can't open (rare), we degrade to RESNAPSHOT-only behavior.
    let mut probe = snapshot::ChangeProbe::new().ok();
    let mut sync = tokio::time::interval(SYNC_POLL_INTERVAL);
    sync.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tokio::select! {
            _ = shutdown.changed() => {
                log::info!("[bridge] connection closed by desktop");
                return Ok(());
            }
            _ = ping.tick() => {
                send_app(&mut stream, &mut transport, OP_PING, &json!({ "at": now_iso() })).await?;
            }
            _ = sync.tick() => {
                if probe.as_mut().is_some_and(snapshot::ChangeProbe::changed) {
                    send_snapshot(&mut stream, &mut transport).await?;
                }
            }
            frame = read_frame(&mut stream) => {
                let frame = frame?;
                let mut buf = vec![0u8; NOISE_MAX];
                let n = transport
                    .read_message(&frame, &mut buf)
                    .map_err(|e| BridgeError::Noise(e.to_string()))?;
                if n == 0 { continue; }
                let opcode = buf[0];
                match opcode {
                    OP_PONG | OP_SUBSCRIBE => { /* read-only: liveness / filter only */ }
                    OP_RESNAPSHOT => {
                        send_snapshot(&mut stream, &mut transport).await?;
                    }
                    op => match MobileAction::from_opcode(op) {
                        // Mobile action: stamp origin server-side, forward to the
                        // trusted frontend, then reply. Writes get an ACK; read-only
                        // queries get their result frame carrying `data`.
                        Some(action) => {
                            let data: Value = if n > 1 {
                                serde_json::from_slice(&buf[1..n]).unwrap_or(Value::Null)
                            } else {
                                Value::Null
                            };
                            let reply_op = if action.is_query() { OP_QUERY_RESULT } else { OP_ACK };
                            let result = run_command(&ctx, action, data).await;
                            send_app(&mut stream, &mut transport, reply_op, &result).await?;
                        }
                        None => log::warn!("[bridge] unexpected client opcode {op:#04x}"),
                    },
                }
            }
        }
    }
}

/// Forwards a mobile-originated command to the trusted frontend executor and
/// awaits its result. `origin` is stamped `Mobile` here — server-side and
/// unforgeable — so the frontend guard applies the locked-down profile. The
/// phone only ever supplies `data` (and an optional correlation id).
async fn run_command(ctx: &Arc<ServerCtx>, action: MobileAction, data: Value) -> Value {
    // The phone may supply a correlation id so it can match this ACK; otherwise
    // mint one. This is the only phone-controlled field we read here.
    let id = data
        .get("cmdId")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(super::commands::random_id);

    let (tx, rx) = oneshot::channel::<CmdResult>();
    ctx.pending.lock().await.insert(id.clone(), tx);

    let event = CommandEvent {
        id: id.clone(),
        kind: action.kind(),
        origin: Origin::Mobile,
        data,
    };

    if let Err(e) = ctx.app.emit("bridge://command", &event) {
        ctx.pending.lock().await.remove(&id);
        return json!({ "cmdId": id, "ok": false, "error": format!("forward failed: {e}") });
    }

    match tokio::time::timeout(ACK_TIMEOUT, rx).await {
        Ok(Ok(res)) => json!({ "cmdId": id, "ok": res.ok, "error": res.error, "data": res.data }),
        Ok(Err(_)) => {
            json!({ "cmdId": id, "ok": false, "error": "executor dropped before responding" })
        }
        Err(_) => {
            ctx.pending.lock().await.remove(&id);
            json!({ "cmdId": id, "ok": false, "error": "timed out waiting for desktop" })
        }
    }
}

/// Encrypts `[opcode || json]` and writes it as one framed Noise message.
async fn send_app(
    stream: &mut TcpStream,
    transport: &mut snow::TransportState,
    opcode: u8,
    payload: &serde_json::Value,
) -> Result<(), BridgeError> {
    let mut plain = Vec::with_capacity(256);
    plain.push(opcode);
    serde_json::to_writer(&mut plain, payload).map_err(BridgeError::Json)?;
    let mut ct = vec![0u8; plain.len() + 16];
    let len = transport
        .write_message(&plain, &mut ct)
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    write_frame(stream, &ct[..len]).await
}

/// Builds a fresh snapshot and streams it (used for RESNAPSHOT).
async fn send_snapshot(
    stream: &mut TcpStream,
    transport: &mut snow::TransportState,
) -> Result<(), BridgeError> {
    let snap = snapshot::build()?;
    stream_snapshot(stream, transport, &snap).await
}

/// BEGIN -> CHUNK* -> END for an already-built snapshot.
async fn stream_snapshot(
    stream: &mut TcpStream,
    transport: &mut snow::TransportState,
    snap: &Snapshot,
) -> Result<(), BridgeError> {
    let total = snap.total_chunks();

    send_app(
        stream,
        transport,
        OP_SNAPSHOT_BEGIN,
        &json!({
            "snapshotId": snap.snapshot_id,
            "headMigration": snap.head_migration,
            "totalChunks": total,
            "transcriptWindow": { "perSessionMaxEvents": 500, "maxAgeHours": 24 },
        }),
    )
    .await?;

    for index in 0..total {
        send_app(
            stream,
            transport,
            OP_SNAPSHOT_CHUNK,
            &json!({
                "snapshotId": snap.snapshot_id,
                "index": index,
                "bytesB64": snap.chunk_b64(index),
            }),
        )
        .await?;
    }

    send_app(
        stream,
        transport,
        OP_SNAPSHOT_END,
        &json!({ "snapshotId": snap.snapshot_id, "sha256": snap.sha256_hex }),
    )
    .await?;

    Ok(())
}

fn now_iso() -> String {
    snapshot::iso_now()
}
