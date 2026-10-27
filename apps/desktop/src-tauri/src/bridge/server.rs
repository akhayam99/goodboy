use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, watch, Mutex};

use super::commands::{CmdResult, CommandEvent, MobileAction, Origin, PendingMap, ACK_TIMEOUT};
use super::frame::{read_frame, write_frame, NOISE_MAX};
use super::gate::{HandshakeGate, HandshakePermit, MAX_UNAUTHENTICATED};
use super::identity::Identity;
use super::snapshot::{self, Snapshot};
use super::tokens::TokenStore;
use super::{noise_params, BridgeError};

const OP_HELLO: u8 = 0x01;
const OP_SNAPSHOT_BEGIN: u8 = 0x02;
const OP_SNAPSHOT_CHUNK: u8 = 0x03;
const OP_SNAPSHOT_END: u8 = 0x04;
const OP_PING: u8 = 0x07;
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

pub async fn serve(listener: TcpListener, ctx: Arc<ServerCtx>) {
    let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
    loop {
        match listener.accept().await {
            Ok((stream, peer)) => {
                let Some(permit) = gate.try_enter(peer.ip()) else {
                    log::debug!("[bridge] refused {}: handshake slots busy", peer.ip());
                    continue;
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

async fn handle_conn(
    mut stream: TcpStream,
    ctx: Arc<ServerCtx>,
    permit: HandshakePermit,
) -> Result<(), BridgeError> {
    let mut transport =
        authorize_within(&mut stream, &ctx.identity, &ctx.tokens, HANDSHAKE_TIMEOUT).await?;
    drop(permit);

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

async fn authorize_within(
    stream: &mut TcpStream,
    identity: &Mutex<Identity>,
    tokens: &TokenStore,
    deadline: Duration,
) -> Result<snow::TransportState, BridgeError> {
    tokio::time::timeout(deadline, authorize_handshake(stream, identity, tokens))
        .await
        .map_err(|_| BridgeError::Protocol("handshake timed out".into()))?
}

async fn authorize_handshake(
    stream: &mut TcpStream,
    identity: &Mutex<Identity>,
    tokens: &TokenStore,
) -> Result<snow::TransportState, BridgeError> {
    let static_priv = { identity.lock().await.static_priv()? };
    let mut hs = snow::Builder::new(noise_params())
        .local_private_key(&static_priv)
        .build_responder()
        .map_err(|e| BridgeError::Noise(e.to_string()))?;

    let mut scratch = vec![0u8; NOISE_MAX];

    let msg1 = read_frame(stream).await?;
    let n = hs
        .read_message(&msg1, &mut scratch)
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    let msg1_payload = scratch[..n].to_vec();

    let enrolling = match msg1_payload.len() {
        0 => false,
        32 => {
            if !tokens.consume(&msg1_payload) {
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

    let len = hs
        .write_message(&[], &mut scratch)
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    write_frame(stream, &scratch[..len]).await?;

    let msg3 = read_frame(stream).await?;
    hs.read_message(&msg3, &mut scratch)
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    let phone_static = hs
        .get_remote_static()
        .ok_or_else(|| BridgeError::Protocol("missing phone static after msg3".into()))?
        .to_vec();

    {
        let mut id = identity.lock().await;
        if enrolling {
            id.enroll(&phone_static)?;
        } else if !id.is_enrolled(&phone_static) {
            return Err(BridgeError::Unauthorized("phone not enrolled".into()));
        }
    }

    hs.into_transport_mode()
        .map_err(|e| BridgeError::Noise(e.to_string()))
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

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine as _;
    use std::path::PathBuf;

    struct Phone {
        private: Vec<u8>,
        public: Vec<u8>,
    }

    fn new_phone() -> Phone {
        let pair = snow::Builder::new(noise_params())
            .generate_keypair()
            .unwrap();
        Phone {
            private: pair.private,
            public: pair.public,
        }
    }

    struct Desktop {
        dir: PathBuf,
        identity: Arc<Mutex<Identity>>,
        tokens: Arc<TokenStore>,
        static_pub: Vec<u8>,
    }

    impl Desktop {
        fn new(name: &str, tokens: TokenStore) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "goodboy-bridge-server-{name}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            let identity = Identity::load_or_create_at(&dir.join("companion.json")).unwrap();
            let static_pub = base64::engine::general_purpose::STANDARD
                .decode(&identity.static_pub_b64)
                .unwrap();
            Self {
                dir,
                identity: Arc::new(Mutex::new(identity)),
                tokens: Arc::new(tokens),
                static_pub,
            }
        }

        async fn is_enrolled(&self, phone: &Phone) -> bool {
            self.identity.lock().await.is_enrolled(&phone.public)
        }

        async fn enroll(&self, phone: &Phone) {
            self.identity.lock().await.enroll(&phone.public).unwrap();
        }

        async fn revoke_all(&self) {
            self.identity.lock().await.revoke_all().unwrap();
        }

        async fn reload_from_disk(&self) -> Arc<Mutex<Identity>> {
            let path = self.dir.join("companion.json");
            Arc::new(Mutex::new(Identity::load_or_create_at(&path).unwrap()))
        }
    }

    impl Drop for Desktop {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    struct Attempt {
        server: Result<(), BridgeError>,
        heard_by_phone: Option<Value>,
    }

    async fn dial(
        desktop: &Desktop,
        identity: Arc<Mutex<Identity>>,
        phone: &Phone,
        payload: &[u8],
    ) -> Attempt {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let tokens = desktop.tokens.clone();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut transport = authorize_handshake(&mut stream, &identity, &tokens).await?;
            send_app(
                &mut stream,
                &mut transport,
                OP_PING,
                &json!({ "at": "now" }),
            )
            .await
        });

        let mut stream = TcpStream::connect(addr).await.unwrap();
        let heard_by_phone = tokio::time::timeout(
            Duration::from_secs(5),
            phone_side(&mut stream, desktop, phone, payload),
        )
        .await
        .expect("the phone side finished the attempt");
        let server = tokio::time::timeout(Duration::from_secs(5), server)
            .await
            .expect("the server finished the attempt")
            .unwrap();
        Attempt {
            server,
            heard_by_phone,
        }
    }

    async fn phone_side(
        stream: &mut TcpStream,
        desktop: &Desktop,
        phone: &Phone,
        payload: &[u8],
    ) -> Option<Value> {
        let mut hs = snow::Builder::new(noise_params())
            .local_private_key(&phone.private)
            .remote_public_key(&desktop.static_pub)
            .build_initiator()
            .unwrap();
        let mut buf = vec![0u8; NOISE_MAX];
        let len = hs.write_message(payload, &mut buf).unwrap();
        write_frame(stream, &buf[..len]).await.unwrap();
        let msg2 = read_frame(stream).await.ok()?;
        hs.read_message(&msg2, &mut buf).ok()?;
        let len = hs.write_message(&[], &mut buf).unwrap();
        write_frame(stream, &buf[..len]).await.ok()?;
        let mut transport = hs.into_transport_mode().unwrap();
        let frame = read_frame(stream).await.ok()?;
        let n = transport.read_message(&frame, &mut buf).ok()?;
        assert_eq!(buf[0], OP_PING);
        serde_json::from_slice(&buf[1..n]).ok()
    }

    fn unauthorized(attempt: &Attempt) -> Option<&str> {
        match &attempt.server {
            Err(BridgeError::Unauthorized(reason)) => Some(reason.as_str()),
            _ => None,
        }
    }

    #[tokio::test]
    async fn a_silent_socket_is_dropped_when_the_handshake_deadline_passes() {
        let desktop = Desktop::new("silent", TokenStore::new());
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let identity = desktop.identity.clone();
        let tokens = desktop.tokens.clone();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            authorize_within(&mut stream, &identity, &tokens, Duration::from_millis(200))
                .await
                .map(|_| ())
        });
        let _silent = TcpStream::connect(addr).await.unwrap();

        let result = tokio::time::timeout(Duration::from_secs(5), server)
            .await
            .expect("the deadline fired")
            .unwrap();

        assert!(matches!(
            result,
            Err(BridgeError::Protocol(ref reason)) if reason == "handshake timed out"
        ));
    }

    #[tokio::test]
    async fn a_phone_that_stalls_after_the_first_message_is_dropped_at_the_deadline() {
        let desktop = Desktop::new("stalled", TokenStore::new());
        let phone = new_phone();
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let identity = desktop.identity.clone();
        let tokens = desktop.tokens.clone();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            authorize_within(&mut stream, &identity, &tokens, Duration::from_millis(200))
                .await
                .map(|_| ())
        });
        let mut stream = TcpStream::connect(addr).await.unwrap();
        let mut hs = snow::Builder::new(noise_params())
            .local_private_key(&phone.private)
            .remote_public_key(&desktop.static_pub)
            .build_initiator()
            .unwrap();
        let mut buf = vec![0u8; NOISE_MAX];
        let len = hs.write_message(&[], &mut buf).unwrap();
        write_frame(&mut stream, &buf[..len]).await.unwrap();

        let result = tokio::time::timeout(Duration::from_secs(5), server)
            .await
            .expect("the deadline fired")
            .unwrap();

        assert!(matches!(result, Err(BridgeError::Protocol(_))));
    }

    #[tokio::test]
    async fn a_flood_of_silent_sockets_is_refused_past_the_gate() {
        let gate = HandshakeGate::new(MAX_UNAUTHENTICATED);
        let held: Vec<_> = (1..=MAX_UNAUTHENTICATED as u8)
            .map(|n| gate.try_enter(std::net::IpAddr::from([10, 0, 0, n])))
            .collect();

        assert!(held.iter().all(Option::is_some));
        assert!(gate
            .try_enter(std::net::IpAddr::from([10, 0, 0, 99]))
            .is_none());
    }

    #[tokio::test]
    async fn a_fresh_token_enrolls_the_phone_and_opens_an_encrypted_channel() {
        let desktop = Desktop::new("enroll", TokenStore::new());
        let phone = new_phone();
        let token = desktop.tokens.mint();

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &token).await;

        assert!(attempt.server.is_ok());
        assert_eq!(attempt.heard_by_phone, Some(json!({ "at": "now" })));
        assert!(desktop.is_enrolled(&phone).await);
    }

    #[tokio::test]
    async fn a_token_that_already_paired_one_phone_cannot_pair_another() {
        let desktop = Desktop::new("token-twice", TokenStore::new());
        let first = new_phone();
        let second = new_phone();
        let token = desktop.tokens.mint();
        let paired = dial(&desktop, desktop.identity.clone(), &first, &token).await;
        assert!(paired.server.is_ok());

        let replay = dial(&desktop, desktop.identity.clone(), &second, &token).await;

        assert_eq!(unauthorized(&replay), Some("invalid or expired token"));
        assert_eq!(replay.heard_by_phone, None);
        assert!(!desktop.is_enrolled(&second).await);
        assert!(desktop.is_enrolled(&first).await);
    }

    #[tokio::test]
    async fn an_expired_token_does_not_pair() {
        let desktop = Desktop::new("token-expired", TokenStore::with_ttl(Duration::ZERO));
        let phone = new_phone();
        let token = desktop.tokens.mint();

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &token).await;

        assert_eq!(unauthorized(&attempt), Some("invalid or expired token"));
        assert_eq!(attempt.heard_by_phone, None);
        assert!(!desktop.is_enrolled(&phone).await);
    }

    #[tokio::test]
    async fn a_guessed_token_does_not_pair() {
        let desktop = Desktop::new("token-guessed", TokenStore::new());
        desktop.tokens.mint();
        let phone = new_phone();

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &[9u8; 32]).await;

        assert_eq!(unauthorized(&attempt), Some("invalid or expired token"));
        assert!(!desktop.is_enrolled(&phone).await);
    }

    #[tokio::test]
    async fn a_payload_that_is_neither_empty_nor_a_token_is_a_protocol_error() {
        let desktop = Desktop::new("payload-size", TokenStore::new());
        let phone = new_phone();

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &[1u8; 5]).await;

        assert!(matches!(attempt.server, Err(BridgeError::Protocol(_))));
        assert_eq!(attempt.heard_by_phone, None);
        assert!(!desktop.is_enrolled(&phone).await);
    }

    #[tokio::test]
    async fn an_enrolled_phone_re_dials_without_a_token() {
        let desktop = Desktop::new("redial", TokenStore::new());
        let phone = new_phone();
        desktop.enroll(&phone).await;

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &[]).await;

        assert!(attempt.server.is_ok());
        assert_eq!(attempt.heard_by_phone, Some(json!({ "at": "now" })));
    }

    #[tokio::test]
    async fn a_phone_that_never_paired_cannot_re_dial_even_when_others_are_enrolled() {
        let desktop = Desktop::new("stranger", TokenStore::new());
        desktop.enroll(&new_phone()).await;
        let stranger = new_phone();

        let attempt = dial(&desktop, desktop.identity.clone(), &stranger, &[]).await;

        assert_eq!(unauthorized(&attempt), Some("phone not enrolled"));
        assert_eq!(attempt.heard_by_phone, None);
    }

    #[tokio::test]
    async fn a_revoked_phone_fails_the_handshake_and_stays_out_after_a_restart() {
        let desktop = Desktop::new("revoked", TokenStore::new());
        let phone = new_phone();
        desktop.enroll(&phone).await;
        let before = dial(&desktop, desktop.identity.clone(), &phone, &[]).await;
        assert!(before.server.is_ok());

        desktop.revoke_all().await;

        let after = dial(&desktop, desktop.identity.clone(), &phone, &[]).await;
        assert_eq!(unauthorized(&after), Some("phone not enrolled"));
        assert_eq!(after.heard_by_phone, None);
        let restarted = dial(&desktop, desktop.reload_from_disk().await, &phone, &[]).await;
        assert_eq!(unauthorized(&restarted), Some("phone not enrolled"));
    }

    #[tokio::test]
    async fn a_revoked_phone_gets_back_in_only_through_a_fresh_token() {
        let desktop = Desktop::new("re-pair", TokenStore::new());
        let phone = new_phone();
        desktop.enroll(&phone).await;
        desktop.revoke_all().await;
        let token = desktop.tokens.mint();

        let repaired = dial(&desktop, desktop.identity.clone(), &phone, &token).await;

        assert!(repaired.server.is_ok());
        assert!(desktop.is_enrolled(&phone).await);
    }
}
