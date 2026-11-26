use std::fmt;
use std::time::Duration;

use serde_json::json;
use tokio::net::TcpStream;
use tokio::sync::Mutex;

use super::frame::{read_frame, write_frame, NOISE_MAX};
use super::identity::{clean_phone_name, Identity};
use super::permissions::Permissions;
use super::server::send_app;
use super::tokens::TokenStore;
use super::{noise_params, BridgeError};

pub const PROTOCOL_VERSION: u8 = 2;
pub const OP_REFUSED: u8 = 0x0E;

const NAME_FIELD: usize = 64;
const TOKEN_LEN: usize = 32;
const FLAG_TOKEN: u8 = 0x01;
const V2_RECONNECT_LEN: usize = 2 + NAME_FIELD;
const V2_ENROLL_LEN: usize = 2 + TOKEN_LEN + NAME_FIELD;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefusalCode {
    ProtocolUnsupported,
    NotPaired,
    TokenInvalid,
}

impl RefusalCode {
    pub fn wire(self) -> &'static str {
        match self {
            Self::ProtocolUnsupported => "protocol_unsupported",
            Self::NotPaired => "not_paired",
            Self::TokenInvalid => "token_invalid",
        }
    }

    pub fn message(self) -> &'static str {
        match self {
            Self::ProtocolUnsupported => {
                "This Goodboy for iPhone is too old for this Mac. Update the app, then pair again."
            }
            Self::NotPaired => {
                "This Mac does not know this iPhone. Scan a new code in Settings, iPhone."
            }
            Self::TokenInvalid => {
                "This code was used or has expired. Scan the new code in Settings, iPhone."
            }
        }
    }

    pub fn is_polite(self) -> bool {
        matches!(self, Self::ProtocolUnsupported)
    }
}

impl fmt::Display for RefusalCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.wire())
    }
}

pub struct Authorized {
    pub transport: snow::TransportState,
    pub phone_key: Vec<u8>,
    pub permissions: Permissions,
}

enum Intent {
    Unsupported,
    Phone {
        token: Option<Vec<u8>>,
        name: String,
    },
}

fn parse_hello(payload: &[u8]) -> Result<Intent, BridgeError> {
    let len = payload.len();
    if len == 0 || len == TOKEN_LEN {
        return Ok(Intent::Unsupported);
    }
    let first = payload.first().copied().unwrap_or(0);
    let is_v2_shape = len == V2_RECONNECT_LEN || len == V2_ENROLL_LEN;
    if first == PROTOCOL_VERSION && is_v2_shape {
        let has_token = payload[1] & FLAG_TOKEN != 0;
        if has_token != (len == V2_ENROLL_LEN) {
            return Err(BridgeError::Protocol(
                "msg1 flags disagree with length".into(),
            ));
        }
        let (token, name_bytes) = match has_token {
            true => (
                Some(payload[2..2 + TOKEN_LEN].to_vec()),
                &payload[2 + TOKEN_LEN..],
            ),
            false => (None, &payload[2..]),
        };
        let end = name_bytes
            .iter()
            .position(|&b| b == 0)
            .unwrap_or(name_bytes.len());
        let name = clean_phone_name(&String::from_utf8_lossy(&name_bytes[..end]));
        return Ok(Intent::Phone { token, name });
    }
    if first > PROTOCOL_VERSION {
        return Ok(Intent::Unsupported);
    }
    Err(BridgeError::Protocol(format!(
        "msg1 payload of {len} bytes is not a pairing hello"
    )))
}

pub async fn authorize_within(
    stream: &mut TcpStream,
    identity: &Mutex<Identity>,
    tokens: &TokenStore,
    deadline: Duration,
) -> Result<Authorized, BridgeError> {
    tokio::time::timeout(deadline, authorize_handshake(stream, identity, tokens))
        .await
        .map_err(|_| BridgeError::Protocol("handshake timed out".into()))?
}

pub async fn authorize_handshake(
    stream: &mut TcpStream,
    identity: &Mutex<Identity>,
    tokens: &TokenStore,
) -> Result<Authorized, BridgeError> {
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
    let intent = parse_hello(&scratch[..n])?;

    let mut refusal: Option<RefusalCode> = None;
    let mut enroll_as: Option<String> = None;
    match intent {
        Intent::Unsupported => refusal = Some(RefusalCode::ProtocolUnsupported),
        Intent::Phone {
            token: Some(token),
            name,
        } => match tokens.consume(&token) {
            true => enroll_as = Some(name),
            false => refusal = Some(RefusalCode::TokenInvalid),
        },
        Intent::Phone { token: None, .. } => {}
    }

    let len = hs
        .write_message(&[], &mut scratch)
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    write_frame(stream, &scratch[..len]).await?;

    let msg3 = read_frame(stream).await?;
    hs.read_message(&msg3, &mut scratch)
        .map_err(|e| BridgeError::Noise(e.to_string()))?;
    let phone_key = hs
        .get_remote_static()
        .ok_or_else(|| BridgeError::Protocol("missing phone static after msg3".into()))?
        .to_vec();

    let mut permissions = Permissions::default();
    if refusal.is_none() {
        let mut id = identity.lock().await;
        match enroll_as {
            Some(name) => id.enroll(&phone_key, &name)?,
            None => {
                if !id.is_enrolled(&phone_key) {
                    refusal = Some(RefusalCode::NotPaired);
                }
            }
        }
        if refusal.is_none() {
            id.touch_seen(&phone_key)?;
            permissions = id.permissions_of(&phone_key).unwrap_or_default();
        }
    }

    let mut transport = hs
        .into_transport_mode()
        .map_err(|e| BridgeError::Noise(e.to_string()))?;

    if let Some(code) = refusal {
        send_app(
            stream,
            &mut transport,
            OP_REFUSED,
            &json!({
                "code": code.wire(),
                "message": code.message(),
                "desktopProtocol": PROTOCOL_VERSION,
            }),
        )
        .await
        .ok();
        return Err(BridgeError::Refused(code));
    }

    Ok(Authorized {
        transport,
        phone_key,
        permissions,
    })
}

#[cfg(test)]
mod tests {
    use super::super::server::OP_PING;
    use super::*;
    use base64::Engine as _;
    use serde_json::Value;
    use std::path::PathBuf;
    use std::sync::Arc;
    use tokio::net::TcpListener;

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

    fn v2_hello(token: Option<&[u8]>, name: &str) -> Vec<u8> {
        let mut out = vec![PROTOCOL_VERSION, u8::from(token.is_some())];
        if let Some(token) = token {
            out.extend_from_slice(token);
        }
        let mut field = name.as_bytes().to_vec();
        field.resize(NAME_FIELD, 0);
        out.extend_from_slice(&field);
        out
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
                "goodboy-bridge-handshake-{name}-{}-{}",
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
            self.identity
                .lock()
                .await
                .enroll(&phone.public, "Harborline iPhone")
                .unwrap();
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
        heard_by_phone: Option<(u8, Value)>,
    }

    impl Attempt {
        fn refusal(&self) -> Option<RefusalCode> {
            match &self.server {
                Err(BridgeError::Refused(code)) => Some(*code),
                _ => None,
            }
        }

        fn refusal_code_heard(&self) -> Option<String> {
            let (op, body) = self.heard_by_phone.as_ref()?;
            if *op != OP_REFUSED {
                return None;
            }
            body["code"].as_str().map(str::to_string)
        }
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
            let mut auth = authorize_handshake(&mut stream, &identity, &tokens).await?;
            send_app(
                &mut stream,
                &mut auth.transport,
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
    ) -> Option<(u8, Value)> {
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
        let body = serde_json::from_slice(&buf[1..n]).ok()?;
        Some((buf[0], body))
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
        let len = hs.write_message(&v2_hello(None, "x"), &mut buf).unwrap();
        write_frame(&mut stream, &buf[..len]).await.unwrap();

        let result = tokio::time::timeout(Duration::from_secs(5), server)
            .await
            .expect("the deadline fired")
            .unwrap();

        assert!(matches!(result, Err(BridgeError::Protocol(_))));
    }

    #[tokio::test]
    async fn a_fresh_token_enrolls_the_phone_with_its_name_and_opens_an_encrypted_channel() {
        let desktop = Desktop::new("enroll", TokenStore::new());
        let phone = new_phone();
        let token = desktop.tokens.mint();

        let attempt = dial(
            &desktop,
            desktop.identity.clone(),
            &phone,
            &v2_hello(Some(&token), "Maya's iPhone"),
        )
        .await;

        assert!(attempt.server.is_ok());
        assert_eq!(
            attempt.heard_by_phone,
            Some((OP_PING, json!({ "at": "now" })))
        );
        assert!(desktop.is_enrolled(&phone).await);
        assert_eq!(
            desktop.identity.lock().await.phones[0].name,
            "Maya's iPhone"
        );
    }

    #[tokio::test]
    async fn a_token_that_already_paired_one_phone_cannot_pair_another() {
        let desktop = Desktop::new("token-twice", TokenStore::new());
        let first = new_phone();
        let second = new_phone();
        let token = desktop.tokens.mint();
        let hello = v2_hello(Some(&token), "Harborline iPhone");
        let paired = dial(&desktop, desktop.identity.clone(), &first, &hello).await;
        assert!(paired.server.is_ok());

        let replay = dial(&desktop, desktop.identity.clone(), &second, &hello).await;

        assert_eq!(replay.refusal(), Some(RefusalCode::TokenInvalid));
        assert_eq!(
            replay.refusal_code_heard().as_deref(),
            Some("token_invalid")
        );
        assert!(!desktop.is_enrolled(&second).await);
        assert!(desktop.is_enrolled(&first).await);
    }

    #[tokio::test]
    async fn an_expired_token_does_not_pair() {
        let desktop = Desktop::new("token-expired", TokenStore::with_ttl(Duration::ZERO));
        let phone = new_phone();
        let token = desktop.tokens.mint();

        let attempt = dial(
            &desktop,
            desktop.identity.clone(),
            &phone,
            &v2_hello(Some(&token), "Harborline iPhone"),
        )
        .await;

        assert_eq!(attempt.refusal(), Some(RefusalCode::TokenInvalid));
        assert!(!desktop.is_enrolled(&phone).await);
    }

    #[tokio::test]
    async fn a_guessed_token_does_not_pair() {
        let desktop = Desktop::new("token-guessed", TokenStore::new());
        desktop.tokens.mint();
        let phone = new_phone();

        let attempt = dial(
            &desktop,
            desktop.identity.clone(),
            &phone,
            &v2_hello(Some(&[9u8; 32]), "Harborline iPhone"),
        )
        .await;

        assert_eq!(attempt.refusal(), Some(RefusalCode::TokenInvalid));
        assert!(!desktop.is_enrolled(&phone).await);
    }

    #[tokio::test]
    async fn a_payload_that_is_no_known_hello_is_a_protocol_error() {
        let desktop = Desktop::new("payload-size", TokenStore::new());
        let phone = new_phone();

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &[1u8; 5]).await;

        assert!(matches!(attempt.server, Err(BridgeError::Protocol(_))));
        assert_eq!(attempt.heard_by_phone, None);
        assert!(!desktop.is_enrolled(&phone).await);
    }

    #[tokio::test]
    async fn a_hello_whose_flag_disagrees_with_its_length_is_a_protocol_error() {
        let desktop = Desktop::new("flag-mismatch", TokenStore::new());
        let phone = new_phone();
        let mut hello = v2_hello(None, "Harborline iPhone");
        hello[1] = 1;

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &hello).await;

        assert!(matches!(attempt.server, Err(BridgeError::Protocol(_))));
    }

    #[tokio::test]
    async fn an_enrolled_phone_re_dials_without_a_token() {
        let desktop = Desktop::new("redial", TokenStore::new());
        let phone = new_phone();
        desktop.enroll(&phone).await;

        let attempt = dial(
            &desktop,
            desktop.identity.clone(),
            &phone,
            &v2_hello(None, "Harborline iPhone"),
        )
        .await;

        assert!(attempt.server.is_ok());
        assert_eq!(
            attempt.heard_by_phone,
            Some((OP_PING, json!({ "at": "now" })))
        );
    }

    #[tokio::test]
    async fn a_phone_that_never_paired_cannot_re_dial_even_when_others_are_enrolled() {
        let desktop = Desktop::new("stranger", TokenStore::new());
        desktop.enroll(&new_phone()).await;
        let stranger = new_phone();

        let attempt = dial(
            &desktop,
            desktop.identity.clone(),
            &stranger,
            &v2_hello(None, "Northwind iPhone"),
        )
        .await;

        assert_eq!(attempt.refusal(), Some(RefusalCode::NotPaired));
        assert_eq!(attempt.refusal_code_heard().as_deref(), Some("not_paired"));
    }

    #[tokio::test]
    async fn a_revoked_phone_fails_the_handshake_and_stays_out_after_a_restart() {
        let desktop = Desktop::new("revoked", TokenStore::new());
        let phone = new_phone();
        let hello = v2_hello(None, "Harborline iPhone");
        desktop.enroll(&phone).await;
        let before = dial(&desktop, desktop.identity.clone(), &phone, &hello).await;
        assert!(before.server.is_ok());

        desktop.revoke_all().await;

        let after = dial(&desktop, desktop.identity.clone(), &phone, &hello).await;
        assert_eq!(after.refusal(), Some(RefusalCode::NotPaired));
        let restarted = dial(&desktop, desktop.reload_from_disk().await, &phone, &hello).await;
        assert_eq!(restarted.refusal(), Some(RefusalCode::NotPaired));
    }

    #[tokio::test]
    async fn one_revoked_phone_is_refused_while_the_other_still_connects() {
        let desktop = Desktop::new("revoke-one", TokenStore::new());
        let revoked = new_phone();
        let kept = new_phone();
        let hello = v2_hello(None, "Harborline iPhone");
        desktop.enroll(&revoked).await;
        desktop.enroll(&kept).await;
        let key = base64::engine::general_purpose::STANDARD.encode(&revoked.public);
        desktop.identity.lock().await.revoke_one(&key).unwrap();

        let gone = dial(&desktop, desktop.identity.clone(), &revoked, &hello).await;
        let still = dial(&desktop, desktop.identity.clone(), &kept, &hello).await;

        assert_eq!(gone.refusal(), Some(RefusalCode::NotPaired));
        assert!(still.server.is_ok());
    }

    #[tokio::test]
    async fn a_revoked_phone_gets_back_in_only_through_a_fresh_token() {
        let desktop = Desktop::new("re-pair", TokenStore::new());
        let phone = new_phone();
        desktop.enroll(&phone).await;
        desktop.revoke_all().await;
        let token = desktop.tokens.mint();

        let repaired = dial(
            &desktop,
            desktop.identity.clone(),
            &phone,
            &v2_hello(Some(&token), "Harborline iPhone"),
        )
        .await;

        assert!(repaired.server.is_ok());
        assert!(desktop.is_enrolled(&phone).await);
    }

    #[tokio::test]
    async fn a_v1_phone_with_a_live_token_is_refused_with_a_reason_and_is_not_enrolled() {
        let desktop = Desktop::new("v1-token", TokenStore::new());
        let phone = new_phone();
        let token = desktop.tokens.mint();

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &token).await;

        assert_eq!(attempt.refusal(), Some(RefusalCode::ProtocolUnsupported));
        assert_eq!(
            attempt.refusal_code_heard().as_deref(),
            Some("protocol_unsupported")
        );
        let (_, body) = attempt.heard_by_phone.unwrap();
        assert_eq!(body["desktopProtocol"], 2);
        assert!(body["message"].as_str().unwrap().contains("Update"));
        assert!(!desktop.is_enrolled(&phone).await);
    }

    #[tokio::test]
    async fn a_v1_refusal_does_not_burn_the_pairing_code() {
        let desktop = Desktop::new("v1-keeps-token", TokenStore::new());
        let old = new_phone();
        let current = new_phone();
        let token = desktop.tokens.mint();
        dial(&desktop, desktop.identity.clone(), &old, &token).await;

        let paired = dial(
            &desktop,
            desktop.identity.clone(),
            &current,
            &v2_hello(Some(&token), "Harborline iPhone"),
        )
        .await;

        assert!(paired.server.is_ok());
        assert!(desktop.is_enrolled(&current).await);
    }

    #[tokio::test]
    async fn a_v1_phone_that_was_enrolled_is_refused_too() {
        let desktop = Desktop::new("v1-enrolled", TokenStore::new());
        let phone = new_phone();
        desktop.enroll(&phone).await;

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &[]).await;

        assert_eq!(attempt.refusal(), Some(RefusalCode::ProtocolUnsupported));
        assert_eq!(
            attempt.refusal_code_heard().as_deref(),
            Some("protocol_unsupported")
        );
    }

    #[tokio::test]
    async fn a_phone_from_a_newer_protocol_is_refused_with_the_same_reason() {
        let desktop = Desktop::new("v3", TokenStore::new());
        let phone = new_phone();
        let mut hello = v2_hello(None, "Harborline iPhone");
        hello[0] = 3;
        hello.truncate(10);

        let attempt = dial(&desktop, desktop.identity.clone(), &phone, &hello).await;

        assert_eq!(attempt.refusal(), Some(RefusalCode::ProtocolUnsupported));
    }

    #[test]
    fn only_a_version_refusal_is_polite() {
        assert!(RefusalCode::ProtocolUnsupported.is_polite());
        assert!(!RefusalCode::NotPaired.is_polite());
        assert!(!RefusalCode::TokenInvalid.is_polite());
    }
}
