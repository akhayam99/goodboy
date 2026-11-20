mod commands;
mod frame;
mod gate;
mod identity;
mod server;
mod snapshot;
mod tokens;
#[cfg(test)]
mod wire_shape;

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

impl BridgeError {
    fn kind(&self) -> &'static str {
        match self {
            BridgeError::NoHomeDir => "no_home_dir",
            BridgeError::Noise(_) => "noise",
            BridgeError::Decode(_) => "decode",
            BridgeError::Io(_) => "io",
            BridgeError::Json(_) => "json",
            BridgeError::Db(_) => "db",
            BridgeError::Protocol(_) => "protocol",
            BridgeError::Unauthorized(_) => "unauthorized",
        }
    }
}

crate::util::impl_error_serialize!(BridgeError);

pub struct BridgeState {
    static_pub_b64: String,
    identity: Arc<Mutex<Identity>>,
    tokens: Arc<TokenStore>,
    pending: PendingMap,
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    port: Option<u16>,
    task: Option<JoinHandle<()>>,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QrPayload {
    v: u8,
    device_name: String,
    static_pub: String,
    token: String,
    endpoints: Vec<Endpoint>,
    service_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrInfo {
    payload: String,
    svg: String,
    device_name: String,
    port: u16,
    expires_in_secs: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStatus {
    running: bool,
    port: Option<u16>,
    enrolled_count: usize,
}

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
pub async fn bridge_revoke(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    state.identity.lock().await.revoke_all()?;
    state.stop().await;
    Ok(())
}

#[tauri::command]
pub async fn bridge_stop(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
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

fn primary_ipv4() -> Option<String> {
    use std::net::UdpSocket;
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    sock.connect("8.8.8.8:80").ok()?;
    let ip = sock.local_addr().ok()?.ip();
    if ip.is_loopback() || ip.is_unspecified() {
        return None;
    }
    Some(ip.to_string())
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
