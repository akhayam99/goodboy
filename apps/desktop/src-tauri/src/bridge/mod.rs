//! Companion bridge: the desktop-side responder for Goodboy Mobile.
//!
//! Implements the FROZEN wire/crypto contract in `goodboy-mobile/PROTOCOL.md`
//! (Noise_XK_25519_ChaChaPoly_SHA256 + length-prefixed app frames). Read-only by
//! construction: there is no client opcode that mutates the desktop. The phone
//! observes; the desktop stays the sole writer of `~/.goodboy/data.db`.
//!
//! There is intentionally NO visible "connect your phone" surface. The bridge is
//! reached only via a hidden frontend shortcut that calls `bridge_start`.

mod commands;
mod frame;
mod identity;
mod server;
mod snapshot;
mod tokens;

use std::collections::HashMap;
use std::sync::Arc;

use base64::Engine as _;
use serde::Serialize;
use snow::params::NoiseParams;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, State};
use thiserror::Error;
use tokio::net::TcpListener;
use tokio::sync::{watch, Mutex};

use commands::{CmdResult, PendingMap};
use identity::Identity;
use server::{serve, ServerCtx};
use tokens::TokenStore;

const PROTOCOL_NAME: &str = "Noise_XK_25519_ChaChaPoly_SHA256";
const SERVICE_NAME: &str = "_goodboy._tcp";

pub(crate) fn noise_params() -> NoiseParams {
    PROTOCOL_NAME
        .parse()
        .expect("static Noise protocol name is valid")
}

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("home directory not available")]
    NoHomeDir,
    #[error("noise error: {0}")]
    Noise(String),
    #[error("decode error: {0}")]
    Decode(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("db error: {0}")]
    Db(String),
    #[error("protocol error: {0}")]
    Protocol(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),
}

impl Serialize for BridgeError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// Tauri-managed state. Holds the persisted identity, the live token store, and
/// the running server task (if any).
pub struct BridgeState {
    static_pub_b64: String,
    identity: Arc<Mutex<Identity>>,
    tokens: Arc<TokenStore>,
    /// In-flight mobile commands awaiting a frontend result, keyed by command id.
    pending: PendingMap,
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    port: Option<u16>,
    task: Option<JoinHandle<()>>,
    /// Signals live connections to tear down on stop/revoke.
    shutdown: Option<watch::Sender<bool>>,
}

impl BridgeState {
    pub fn new() -> Result<Self, BridgeError> {
        let identity = Identity::load_or_create()?;
        Ok(Self {
            static_pub_b64: identity.static_pub_b64.clone(),
            identity: Arc::new(Mutex::new(identity)),
            tokens: Arc::new(TokenStore::new()),
            pending: Arc::new(Mutex::new(HashMap::new())),
            inner: Mutex::new(Inner::default()),
        })
    }

    /// Binds the listener and spawns the accept loop once; returns the bound port.
    async fn ensure_running(&self, app: AppHandle) -> Result<u16, BridgeError> {
        let mut inner = self.inner.lock().await;
        if let Some(port) = inner.port {
            return Ok(port);
        }
        let listener = TcpListener::bind(("0.0.0.0", 0)).await?;
        let port = listener.local_addr()?.port();
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        let ctx = Arc::new(ServerCtx {
            identity: self.identity.clone(),
            tokens: self.tokens.clone(),
            device_name: device_name(),
            app,
            pending: self.pending.clone(),
            shutdown: shutdown_rx,
        });
        let task = tauri::async_runtime::spawn(async move {
            serve(listener, ctx).await;
        });
        inner.port = Some(port);
        inner.task = Some(task);
        inner.shutdown = Some(shutdown_tx);
        Ok(port)
    }

    async fn stop(&self) {
        let mut inner = self.inner.lock().await;
        // Trip live connections first so a connected phone is dropped at once,
        // then abort the accept loop so no new ones get in.
        if let Some(shutdown) = inner.shutdown.take() {
            let _ = shutdown.send(true);
        }
        if let Some(task) = inner.task.take() {
            task.abort();
        }
        inner.port = None;
    }
}

#[derive(Serialize)]
pub struct Endpoint {
    host: String,
    port: u16,
}

/// The compact JSON encoded into the QR (PROTOCOL §4).
#[derive(Serialize)]
struct QrPayload {
    v: u8,
    #[serde(rename = "deviceName")]
    device_name: String,
    #[serde(rename = "staticPub")]
    static_pub: String,
    token: String,
    endpoints: Vec<Endpoint>,
    #[serde(rename = "serviceName")]
    service_name: String,
}

/// What the hidden modal renders: the QR (as inline SVG) plus diagnostics.
#[derive(Serialize)]
pub struct QrInfo {
    /// Compact JSON payload that the SVG encodes (also handy for debugging).
    payload: String,
    /// Inline SVG markup of the QR code.
    svg: String,
    #[serde(rename = "deviceName")]
    device_name: String,
    port: u16,
    #[serde(rename = "expiresInSecs")]
    expires_in_secs: u16,
}

#[derive(Serialize)]
pub struct BridgeStatus {
    running: bool,
    port: Option<u16>,
    #[serde(rename = "enrolledCount")]
    enrolled_count: usize,
}

/// Starts the bridge (idempotent) and mints a fresh one-time pairing token,
/// returning the QR the phone must scan. Invoked only by the hidden shortcut.
#[tauri::command]
pub async fn bridge_start(
    app: AppHandle,
    state: State<'_, BridgeState>,
) -> Result<QrInfo, BridgeError> {
    let port = state.ensure_running(app).await?;
    let token = state.tokens.mint();
    let device_name = device_name();

    let payload = QrPayload {
        v: 1,
        device_name: device_name.clone(),
        static_pub: state.static_pub_b64.clone(),
        token: base64::engine::general_purpose::STANDARD.encode(&token),
        endpoints: endpoints(port),
        service_name: SERVICE_NAME.to_string(),
    };
    let json = serde_json::to_string(&payload)?;
    let svg = render_qr_svg(&json)?;

    Ok(QrInfo {
        payload: json,
        svg,
        device_name,
        port,
        expires_in_secs: 60,
    })
}

#[tauri::command]
pub async fn bridge_stop(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    state.stop().await;
    Ok(())
}

/// Desktop-initiated disconnect ("forget device"): clears the enrolled-phone
/// allow-list and tears the bridge down, dropping any live connection. The phone
/// must scan a fresh QR to reconnect — re-pairing is a deliberate act here on the
/// desktop, never something a phone can trigger. This is the desktop-side twin of
/// the phone's own "Forget device".
#[tauri::command]
pub async fn bridge_revoke(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    state.identity.lock().await.revoke_all()?;
    state.stop().await;
    Ok(())
}

#[tauri::command]
pub async fn bridge_status(state: State<'_, BridgeState>) -> Result<BridgeStatus, BridgeError> {
    let inner = state.inner.lock().await;
    let enrolled_count = state.identity.lock().await.allow_list.len();
    Ok(BridgeStatus {
        running: inner.port.is_some(),
        port: inner.port,
        enrolled_count,
    })
}

/// The trusted frontend executor reports a mobile command's outcome here; this
/// wakes the connection task waiting in `run_command` so it can ACK the phone.
/// Unknown ids are ignored (already timed out / never existed).
#[tauri::command]
pub async fn bridge_command_result(
    state: State<'_, BridgeState>,
    id: String,
    ok: bool,
    error: Option<String>,
    data: Option<serde_json::Value>,
) -> Result<(), BridgeError> {
    if let Some(tx) = state.pending.lock().await.remove(&id) {
        let _ = tx.send(CmdResult { ok, error, data });
    }
    Ok(())
}

fn render_qr_svg(data: &str) -> Result<String, BridgeError> {
    use qrcode::render::svg;
    use qrcode::QrCode;
    let code = QrCode::new(data.as_bytes()).map_err(|e| BridgeError::Protocol(e.to_string()))?;
    Ok(code
        .render::<svg::Color>()
        .min_dimensions(240, 240)
        .quiet_zone(true)
        .build())
}

fn endpoints(port: u16) -> Vec<Endpoint> {
    let mut out = Vec::new();
    if let Some(ip) = primary_ipv4() {
        out.push(Endpoint { host: ip, port });
    }
    out
}

/// Primary LAN IPv4 via the connected-UDP trick (no packets sent).
fn primary_ipv4() -> Option<String> {
    use std::net::UdpSocket;
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.connect("8.8.8.8:80").ok()?;
    let ip = sock.local_addr().ok()?.ip();
    if ip.is_loopback() || ip.is_unspecified() {
        None
    } else {
        Some(ip.to_string())
    }
}

fn device_name() -> String {
    let mut buf = [0u8; 256];
    let rc = unsafe { libc::gethostname(buf.as_mut_ptr() as *mut libc::c_char, buf.len()) };
    if rc == 0 {
        let end = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
        if let Ok(name) = std::str::from_utf8(&buf[..end]) {
            let trimmed = name.trim_end_matches(".local").trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    "Goodboy Desktop".to_string()
}
