use std::sync::Arc;
use std::time::Duration;

use base64::Engine as _;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, oneshot, watch, Mutex};

use super::action_guard::{action_id_of, correlation_of, stamp_phone, InFlight};
use super::commands::{CmdResult, CommandEvent, MobileAction, Origin, PendingMap, ACK_TIMEOUT};
use super::frame::{read_frame, write_frame, NOISE_MAX};
use super::gate::{HandshakeGate, HandshakePermit, Refusal, MAX_UNAUTHENTICATED};
use super::handshake::authorize_within;
use super::identity::Identity;
use super::permissions::{denial, permission_for};
use super::publish::{PublishHub, Stored, Update};
use super::tokens::TokenStore;
use super::BridgeError;

const OP_HELLO: u8 = 0x01;
pub(super) const OP_PING: u8 = 0x07;
const OP_ACK: u8 = 0x08;
const OP_QUERY_RESULT: u8 = 0x0A;
const OP_PROJECTION: u8 = 0x0B;
const OP_DESKTOP_STATE: u8 = 0x0C;
const OP_PROJECTION_GONE: u8 = 0x0D;
const PROTOCOL_VERSION: u8 = 2;
const OP_PONG: u8 = 0x80;
const OP_SUBSCRIBE: u8 = 0x81;
const OP_RESNAPSHOT: u8 = 0x82;

const PING_INTERVAL: Duration = Duration::from_secs(20);
const SILENCE_LIMIT: Duration = Duration::from_secs(60);
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);
const FRESHNESS_INTERVAL: Duration = Duration::from_secs(1);

pub struct ServerCtx {
    pub identity: Arc<Mutex<Identity>>,
    pub tokens: Arc<TokenStore>,
    pub device_name: String,
    pub app: AppHandle,
    pub pending: PendingMap,
    pub hub: Arc<PublishHub>,
    pub in_flight: InFlight,
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
                    permit.release();
                }
                return Err(e);
            }
        };
    permit.succeed();
    let mut transport = authorized.transport;
    let phone_key = authorized.phone_key;

    let mut updates = ctx.hub.subscribe();
    send_app(
        &mut stream,
        &mut transport,
        OP_HELLO,
        &json!({
            "protocol": PROTOCOL_VERSION,
            "deviceName": ctx.device_name,
            "serverTime": crate::util::iso_now_whole_seconds(),
            "permissions": authorized.permissions.wire(),
        }),
    )
    .await?;
    let mut was_open = ctx.hub.is_fresh();
    send_desktop_state(&mut stream, &mut transport, was_open).await?;
    send_all(&mut stream, &mut transport, &ctx.hub).await?;
    log::info!("[bridge] phone synced");

    let mut shutdown = ctx.shutdown.clone();
    if *shutdown.borrow() {
        return Ok(());
    }

    let mut ping = tokio::time::interval(PING_INTERVAL);
    ping.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut freshness = tokio::time::interval(FRESHNESS_INTERVAL);
    freshness.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
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
            _ = freshness.tick() => {
                let is_open = ctx.hub.is_fresh();
                if is_open != was_open {
                    was_open = is_open;
                    send_desktop_state(&mut stream, &mut transport, is_open).await?;
                }
            }
            update = updates.recv() => {
                match update {
                    Ok(Update::Projection(stored)) => {
                        send_projection(&mut stream, &mut transport, &stored).await?;
                    }
                    Ok(Update::Removed(key)) => {
                        send_app(&mut stream, &mut transport, OP_PROJECTION_GONE, &json!({ "key": key })).await?;
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        send_all(&mut stream, &mut transport, &ctx.hub).await?;
                    }
                    Err(broadcast::error::RecvError::Closed) => return Ok(()),
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
                        send_all(&mut stream, &mut transport, &ctx.hub).await?;
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
                            let claim = match action_id_of(action, &data) {
                                Ok(Some(id)) => match ctx.in_flight.claim(&id) {
                                    Some(claim) => Some(claim),
                                    None => {
                                        let refusal = super::action_guard::Refusal::InFlight {
                                            cmd_id: correlation_of(&data).unwrap_or(id),
                                        };
                                        send_app(&mut stream, &mut transport, reply_op, &refusal.reply()).await?;
                                        continue;
                                    }
                                },
                                Ok(None) => None,
                                Err(refusal) => {
                                    send_app(&mut stream, &mut transport, reply_op, &refusal.reply()).await?;
                                    continue;
                                }
                            };
                            let phone_id = base64::engine::general_purpose::STANDARD.encode(&phone_key);
                            let data = stamp_phone(data, &phone_id);
                            let result = run_command(&ctx, action, data).await;
                            drop(claim);
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
    let id = super::commands::random_id();
    let echo = correlation_of(&data).unwrap_or_else(|| id.clone());

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
        return json!({ "cmdId": echo, "ok": false, "error": format!("forward failed: {e}") });
    }

    match tokio::time::timeout(ACK_TIMEOUT, rx).await {
        Ok(Ok(res)) => json!({ "cmdId": echo, "ok": res.ok, "error": res.error, "data": res.data }),
        Ok(Err(_)) => {
            json!({ "cmdId": echo, "ok": false, "error": "executor dropped before responding" })
        }
        Err(_) => {
            ctx.pending.lock().await.remove(&id);
            json!({ "cmdId": echo, "ok": false, "error": "timed out waiting for desktop" })
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

async fn send_projection(
    stream: &mut TcpStream,
    transport: &mut snow::TransportState,
    stored: &Stored,
) -> Result<(), BridgeError> {
    send_app(
        stream,
        transport,
        OP_PROJECTION,
        &json!({ "key": stored.key, "kind": stored.kind, "projection": stored.value }),
    )
    .await
}

async fn send_all(
    stream: &mut TcpStream,
    transport: &mut snow::TransportState,
    hub: &PublishHub,
) -> Result<(), BridgeError> {
    for stored in hub.all() {
        send_projection(stream, transport, &stored).await?;
    }
    Ok(())
}

async fn send_desktop_state(
    stream: &mut TcpStream,
    transport: &mut snow::TransportState,
    is_open: bool,
) -> Result<(), BridgeError> {
    send_app(
        stream,
        transport,
        OP_DESKTOP_STATE,
        &json!({ "isOpen": is_open, "at": crate::util::iso_now_whole_seconds() }),
    )
    .await
}
