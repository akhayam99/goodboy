use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

use base64::Engine as _;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, oneshot, watch, Mutex, Semaphore};

use super::action_guard::{action_id_of, correlation_of, stamp_phone, InFlight};
use super::advertise::Presence;
use super::commands::{CmdResult, CommandEvent, MobileAction, Origin, PendingMap, ACK_TIMEOUT};
use super::frame::{read_frame, write_frame, NOISE_MAX};
use super::gate::{HandshakeGate, HandshakePermit, Refusal, MAX_UNAUTHENTICATED};
use super::handshake::{authorize_within, refuse_within, Forced, RefusalCode, OP_REFUSED};
use super::identity::Identity;
use super::listen::{bind_ip, endpoints_of, is_accepted_source, plan};
use super::network::{offered_addresses, raw_addresses, RawAddress};
use super::pairing::PairingHold;
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
const REFUSAL_HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(3);
const REFUSAL_SLOTS: usize = 4;

pub type Offered = Arc<std::sync::RwLock<Vec<IpAddr>>>;

const NETWORK_WATCH: Duration = Duration::from_secs(5);
const ACCEPT_PAUSE: Duration = Duration::from_millis(200);

pub struct ServerCtx {
    pub identity: Arc<Mutex<Identity>>,
    pub tokens: Arc<TokenStore>,
    pub device_name: String,
    pub port: u16,
    pub offered: Offered,
    pub pairing: Arc<PairingHold>,
    pub app: AppHandle,
    pub pending: PendingMap,
    pub hub: Arc<PublishHub>,
    pub in_flight: InFlight,
    pub shutdown: watch::Receiver<bool>,
}

pub struct Serving {
    pub port: u16,
    pub first: Vec<(IpAddr, TcpListener)>,
    pub selected: Option<Vec<String>>,
    pub presence: Arc<std::sync::Mutex<Presence>>,
}

fn offered_now(selected: Option<&[String]>) -> Vec<RawAddress> {
    offered_addresses(&raw_addresses(), selected)
}

pub async fn serve(serving: Serving, ctx: Arc<ServerCtx>) {
    let Serving {
        port,
        first,
        selected,
        presence,
    } = serving;
    let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
    let refusals = Arc::new(Semaphore::new(REFUSAL_SLOTS));
    let mut accepting = tokio::task::JoinSet::new();
    let mut live: HashMap<IpAddr, tokio::task::AbortHandle> = HashMap::new();
    for (ip, listener) in first {
        let handle = accepting.spawn(accept_loop(
            listener,
            ctx.clone(),
            gate.clone(),
            refusals.clone(),
        ));
        live.insert(ip, handle);
    }
    let mut every = tokio::time::interval(NETWORK_WATCH);
    every.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        every.tick().await;
        let raw = offered_now(selected.as_deref());
        let ips: Vec<IpAddr> = raw.iter().map(|a| a.ip).collect();
        if let Ok(mut offered) = ctx.offered.write() {
            *offered = ips.clone();
        }
        let current: Vec<IpAddr> = live.keys().copied().collect();
        let (add, remove) = plan(&current, &ips);
        for ip in remove {
            if let Some(handle) = live.remove(&ip) {
                handle.abort();
            }
        }
        for ip in add {
            let Some(listener) = bind_ip(ip, port).await else {
                continue;
            };
            let handle = accepting.spawn(accept_loop(
                listener,
                ctx.clone(),
                gate.clone(),
                refusals.clone(),
            ));
            live.insert(ip, handle);
        }
        if let Ok(mut presence) = presence.lock() {
            if presence.tick(raw) {
                log::info!("[bridge] the networks changed, advertised again");
            }
        }
    }
}

fn is_expected_source(stream: &TcpStream, peer: IpAddr, ctx: &ServerCtx) -> bool {
    let Ok(local) = stream.local_addr() else {
        return false;
    };
    ctx.offered
        .read()
        .is_ok_and(|offered| is_accepted_source(peer, local.ip(), &offered))
}

async fn accept_loop(
    listener: TcpListener,
    ctx: Arc<ServerCtx>,
    gate: HandshakeGate,
    refusals: Arc<Semaphore>,
) {
    loop {
        match listener.accept().await {
            Ok((stream, peer)) => {
                if !is_expected_source(&stream, peer.ip(), &ctx) {
                    log::debug!("[bridge] dropped a connection from outside the private networks");
                    continue;
                }
                let permit = match gate.try_enter(peer.ip()) {
                    Ok(permit) => permit,
                    Err(refusal) => {
                        log_refusal(peer.ip(), refusal);
                        if let Some(forced) = forced_of(refusal) {
                            tokio::spawn(refuse_with_reason(
                                stream,
                                ctx.clone(),
                                refusals.clone(),
                                forced,
                            ));
                        }
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
                tokio::time::sleep(ACCEPT_PAUSE).await;
            }
        }
    }
}

pub(super) fn forced_of(refusal: Refusal) -> Option<Forced> {
    match refusal {
        Refusal::BackedOff { retry_after } | Refusal::Paused { retry_after } => Some(Forced {
            code: RefusalCode::RateLimited,
            retry_after: Some(retry_after),
        }),
        Refusal::Full | Refusal::SourceBusy => None,
    }
}

async fn refuse_with_reason(
    mut stream: TcpStream,
    ctx: Arc<ServerCtx>,
    slots: Arc<Semaphore>,
    forced: Forced,
) {
    let Ok(_slot) = slots.try_acquire() else {
        return;
    };
    let result = refuse_within(
        &mut stream,
        &ctx.identity,
        &ctx.tokens,
        &ctx.pairing,
        forced,
        REFUSAL_HANDSHAKE_TIMEOUT,
    )
    .await;
    log::debug!("[bridge] told a rate limited source why: {result:?}");
}

fn log_refusal(ip: std::net::IpAddr, refusal: Refusal) {
    log::debug!("[bridge] refused {ip}: {refusal:?}");
}

pub(super) fn hello_payload(
    device_name: &str,
    permissions: serde_json::Value,
    offered: &[IpAddr],
    port: u16,
) -> Value {
    json!({
        "protocol": PROTOCOL_VERSION,
        "deviceName": device_name,
        "serverTime": crate::util::iso_now_whole_seconds(),
        "permissions": permissions,
        "endpoints": endpoints_of(offered, port),
    })
}

async fn send_removed(stream: &mut TcpStream, transport: &mut snow::TransportState) {
    let code = RefusalCode::NotPaired;
    let body = json!({
        "code": code.wire(),
        "message": code.message(),
        "desktopProtocol": PROTOCOL_VERSION,
    });
    send_app(stream, transport, OP_REFUSED, &body).await.ok();
}

fn settle_failed(permit: HandshakePermit, error: &BridgeError) {
    match error {
        BridgeError::Refused(code) if code.is_polite() => permit.release(),
        BridgeError::Io(_) => permit.release(),
        BridgeError::Protocol(reason) if reason == "handshake timed out" => permit.fail_source(),
        _ => permit.fail(),
    }
}

async fn handle_conn(
    mut stream: TcpStream,
    ctx: Arc<ServerCtx>,
    permit: HandshakePermit,
) -> Result<(), BridgeError> {
    let authorized = match authorize_within(
        &mut stream,
        &ctx.identity,
        &ctx.tokens,
        &ctx.pairing,
        HANDSHAKE_TIMEOUT,
    )
    .await
    {
        Ok(authorized) => authorized,
        Err(e) => {
            settle_failed(permit, &e);
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
        &hello_payload(
            &ctx.device_name,
            authorized.permissions.wire(),
            &ctx.offered.read().map(|o| o.clone()).unwrap_or_default(),
            ctx.port,
        ),
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
                    send_removed(&mut stream, &mut transport).await;
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
                                send_removed(&mut stream, &mut transport).await;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_backed_off_or_paused_source_is_told_to_wait_and_a_full_gate_stays_silent() {
        let wait = Duration::from_secs(9);

        let backed = forced_of(Refusal::BackedOff { retry_after: wait }).unwrap();
        let paused = forced_of(Refusal::Paused { retry_after: wait }).unwrap();

        assert_eq!(backed.code, RefusalCode::RateLimited);
        assert_eq!(backed.retry_after, Some(wait));
        assert_eq!(paused.code, RefusalCode::RateLimited);
        assert!(forced_of(Refusal::Full).is_none());
        assert!(forced_of(Refusal::SourceBusy).is_none());
    }

    #[test]
    fn the_hello_carries_the_current_private_endpoints_and_nothing_else_secret() {
        let offered: Vec<IpAddr> = ["192.168.1.20", "10.0.0.7", "8.8.8.8"]
            .iter()
            .map(|text| text.parse().unwrap())
            .collect();

        let hello = hello_payload("Mac", json!({}), &offered, 49160);

        assert_eq!(hello["protocol"], PROTOCOL_VERSION);
        assert_eq!(hello["deviceName"], "Mac");
        assert_eq!(
            hello["endpoints"],
            json!([
                { "host": "192.168.1.20", "port": 49160 },
                { "host": "10.0.0.7", "port": 49160 },
            ])
        );
    }
}
