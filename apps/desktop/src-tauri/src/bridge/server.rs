use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, watch, Mutex};

use super::commands::{CmdResult, CommandEvent, MobileAction, Origin, PendingMap, ACK_TIMEOUT};
use super::frame::{read_frame, write_frame, NOISE_MAX};
use super::gate::{HandshakeGate, HandshakePermit, Refusal, MAX_UNAUTHENTICATED};
use super::handshake::authorize_within;
use super::identity::Identity;
use super::permissions::{denial, permission_for};
use super::snapshot::{self, Snapshot};
use super::tokens::TokenStore;
use super::BridgeError;

const OP_HELLO: u8 = 0x01;
const OP_SNAPSHOT_BEGIN: u8 = 0x02;
const OP_SNAPSHOT_CHUNK: u8 = 0x03;
const OP_SNAPSHOT_END: u8 = 0x04;
pub(super) const OP_PING: u8 = 0x07;
const OP_ACK: u8 = 0x08;
const OP_QUERY_RESULT: u8 = 0x0A;
const OP_PONG: u8 = 0x80;
const OP_SUBSCRIBE: u8 = 0x81;
const OP_RESNAPSHOT: u8 = 0x82;

const PING_INTERVAL: Duration = Duration::from_secs(20);
const SILENCE_LIMIT: Duration = Duration::from_secs(60);
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);
const SYNC_POLL_INTERVAL: Duration = Duration::from_secs(2);

pub struct ServerCtx {
    pub identity: Arc<Mutex<Identity>>,
    pub tokens: Arc<TokenStore>,
    pub device_name: String,
    pub app: AppHandle,
    pub pending: PendingMap,
    pub shutdown: watch::Receiver<bool>,
}

pub async fn serve(listeners: Vec<TcpListener>, ctx: Arc<ServerCtx>) {
    let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
    let mut accepting = tokio::task::JoinSet::new();
    for listener in listeners {
        accepting.spawn(accept_loop(listener, ctx.clone(), gate.clone()));
    }
    while accepting.join_next().await.is_some() {}
}

async fn accept_loop(listener: TcpListener, ctx: Arc<ServerCtx>, gate: HandshakeGate) {
    loop {
        match listener.accept().await {
            Ok((stream, peer)) => {
                let permit = match gate.try_enter(peer.ip()) {
                    Ok(permit) => permit,
                    Err(refusal) => {
                        log_refusal(peer.ip(), refusal);
                        continue;
                    }
                };
                let ctx = ctx.clone();
                tokio::spawn(async move {
                    if let Err(e) = handle_conn(stream, ctx, permit).await {
                        log::debug!("[bridge] connection ended: {e}");
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

fn log_refusal(ip: std::net::IpAddr, refusal: Refusal) {
    log::debug!("[bridge] refused {ip}: {refusal:?}");
}

async fn handle_conn(
    mut stream: TcpStream,
    ctx: Arc<ServerCtx>,
    permit: HandshakePermit,
) -> Result<(), BridgeError> {
    let authorized =
        match authorize_within(&mut stream, &ctx.identity, &ctx.tokens, HANDSHAKE_TIMEOUT).await {
            Ok(authorized) => authorized,
            Err(e) => {
                if e.is_polite_refusal() {
                    permit.succeed();
                }
                return Err(e);
            }
        };
    permit.succeed();
    let mut transport = authorized.transport;
    let phone_key = authorized.phone_key;

    let snap = snapshot::build()?;
    send_app(
        &mut stream,
        &mut transport,
        OP_HELLO,
        &json!({
            "protocol": 1,
            "deviceName": ctx.device_name,
            "headMigration": snap.head_migration,
            "serverTime": crate::util::iso_now_whole_seconds(),
            "permissions": authorized.permissions.wire(),
        }),
    )
    .await?;
    stream_snapshot(&mut stream, &mut transport, &snap).await?;
    log::info!("[bridge] phone synced; head {}", snap.head_migration);

    let mut shutdown = ctx.shutdown.clone();
    if *shutdown.borrow() {
        return Ok(());
    }

    let mut ping = tokio::time::interval(PING_INTERVAL);
    ping.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut probe = snapshot::ChangeProbe::new().ok();
    let mut sync = tokio::time::interval(SYNC_POLL_INTERVAL);
    sync.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut last_heard = tokio::time::Instant::now();
    loop {
        tokio::select! {
            _ = shutdown.changed() => {
                log::info!("[bridge] connection closed by desktop");
                return Ok(());
            }
            _ = ping.tick() => {
                if last_heard.elapsed() > SILENCE_LIMIT {
                    return Err(BridgeError::Protocol("phone stopped answering pings".into()));
                }
                if !still_paired(&ctx, &phone_key).await {
                    return Err(BridgeError::Unauthorized("phone was disconnected".into()));
                }
                send_app(&mut stream, &mut transport, OP_PING, &json!({ "at": crate::util::iso_now_whole_seconds() })).await?;
            }
            _ = sync.tick() => {
                if probe.as_mut().is_some_and(snapshot::ChangeProbe::changed) {
                    send_snapshot(&mut stream, &mut transport).await?;
                }
            }
            frame = read_frame(&mut stream) => {
                let frame = frame?;
                last_heard = tokio::time::Instant::now();
                let mut buf = vec![0u8; NOISE_MAX];
                let n = transport
                    .read_message(&frame, &mut buf)
                    .map_err(|e| BridgeError::Noise(e.to_string()))?;
                if n == 0 { continue; }
                let opcode = buf[0];
                match opcode {
                    OP_PONG | OP_SUBSCRIBE => {}
                    OP_RESNAPSHOT => {
                        send_snapshot(&mut stream, &mut transport).await?;
                    }
                    op => match MobileAction::from_opcode(op) {
                        Some(action) => {
                            let current = ctx.identity.lock().await.permissions_of(&phone_key);
                            let Some(permissions) = current else {
                                return Err(BridgeError::Unauthorized("phone was disconnected".into()));
                            };
                            let missing = permission_for(action).filter(|p| !permissions.allows(*p));
                            let data: Value = match n > 1 {
                                true => serde_json::from_slice(&buf[1..n]).unwrap_or(Value::Null),
                                false => Value::Null,
                            };
                            if let Some(permission) = missing {
                                send_app(&mut stream, &mut transport, OP_ACK, &denial(&data, permission)).await?;
                                continue;
                            }
                            let reply_op = match action.is_query() {
                                true => OP_QUERY_RESULT,
                                false => OP_ACK,
                            };
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

async fn still_paired(ctx: &ServerCtx, phone_key: &[u8]) -> bool {
    ctx.identity.lock().await.is_enrolled(phone_key)
}

async fn run_command(ctx: &Arc<ServerCtx>, action: MobileAction, data: Value) -> Value {
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

pub(super) async fn send_app(
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

async fn send_snapshot(
    stream: &mut TcpStream,
    transport: &mut snow::TransportState,
) -> Result<(), BridgeError> {
    let snap = snapshot::build()?;
    stream_snapshot(stream, transport, &snap).await
}

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
