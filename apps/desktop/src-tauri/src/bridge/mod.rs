mod commands;
mod frame;
mod gate;
mod handshake;
mod identity;
mod network;
mod permissions;
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
use handshake::RefusalCode;
use identity::Identity;
use network::{interfaces_of, offered_addresses, raw_addresses, NetworkInterface, RawAddress};
use permissions::Permissions;
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
    #[error("refused: {0}")]
    Refused(RefusalCode),
    #[error("no private network is offered to phones")]
    NoPrivateNetwork,
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
            BridgeError::Refused(_) => "refused",
            BridgeError::NoPrivateNetwork => "no_private_network",
        }
    }

    fn is_polite_refusal(&self) -> bool {
        matches!(self, BridgeError::Refused(code) if code.is_polite())
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
        let selected = self.identity.lock().await.interfaces.clone();
        let offered = offered_addresses(&raw_addresses(), selected.as_deref());
        let (listeners, port) = bind_offered(&offered).await?;
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
            serve(listeners, ctx).await;
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

pub const QR_VERSION: u8 = 2;
const BIND_ATTEMPTS: usize = 8;

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
    permissions: serde_json::Value,
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
    let selected = state.identity.lock().await.interfaces.clone();
    let endpoints = endpoints_for(&raw_addresses(), selected.as_deref(), port);
    if endpoints.is_empty() {
        state.stop().await;
        return Err(BridgeError::NoPrivateNetwork);
    }
    let token = state.tokens.mint();
    let device_name = device_name();

    let payload = QrPayload {
        v: QR_VERSION,
        device_name: device_name.clone(),
        static_pub: state.static_pub_b64.clone(),
        token: base64::engine::general_purpose::STANDARD.encode(&token),
        endpoints,
        service_name: SERVICE_NAME.to_string(),
        permissions: Permissions::default().wire(),
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneView {
    id: String,
    name: String,
    paired_at: String,
    last_seen: Option<String>,
    permissions: Permissions,
}

#[tauri::command]
pub async fn bridge_interfaces(
    state: State<'_, BridgeState>,
) -> Result<Vec<NetworkInterface>, BridgeError> {
    let selected = state.identity.lock().await.interfaces.clone();
    Ok(interfaces_of(&raw_addresses(), selected.as_deref()))
}

#[tauri::command]
pub async fn bridge_set_interfaces(
    state: State<'_, BridgeState>,
    names: Vec<String>,
) -> Result<(), BridgeError> {
    state.identity.lock().await.set_interfaces(Some(names))?;
    state.stop().await;
    Ok(())
}

#[tauri::command]
pub async fn bridge_phones(state: State<'_, BridgeState>) -> Result<Vec<PhoneView>, BridgeError> {
    let id = state.identity.lock().await;
    Ok(id
        .phones
        .iter()
        .map(|p| PhoneView {
            id: p.key.clone(),
            name: p.name.clone(),
            paired_at: p.paired_at.clone(),
            last_seen: p.last_seen.clone(),
            permissions: p.permissions,
        })
        .collect())
}

#[tauri::command]
pub async fn bridge_set_permissions(
    state: State<'_, BridgeState>,
    phone_id: String,
    permissions: Permissions,
) -> Result<(), BridgeError> {
    let did = state
        .identity
        .lock()
        .await
        .set_permissions(&phone_id, permissions)?;
    match did {
        true => Ok(()),
        false => Err(BridgeError::Protocol(
            "that iPhone is no longer paired".into(),
        )),
    }
}

#[tauri::command]
pub async fn bridge_revoke_phone(
    state: State<'_, BridgeState>,
    phone_id: String,
) -> Result<(), BridgeError> {
    state.identity.lock().await.revoke_one(&phone_id)?;
    Ok(())
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
    let enrolled_count = state.identity.lock().await.phones.len();
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

pub(crate) fn endpoints_for(
    raw: &[RawAddress],
    selected: Option<&[String]>,
    port: u16,
) -> Vec<Endpoint> {
    offered_addresses(raw, selected)
        .into_iter()
        .filter(|a| network::is_private(a.ip))
        .map(|a| Endpoint {
            host: a.ip.to_string(),
            port,
        })
        .collect()
}

async fn bind_offered(offered: &[RawAddress]) -> Result<(Vec<TcpListener>, u16), BridgeError> {
    let Some(first) = offered.first() else {
        return Err(BridgeError::NoPrivateNetwork);
    };
    for _ in 0..BIND_ATTEMPTS {
        let lead = TcpListener::bind((first.ip, 0)).await?;
        let port = lead.local_addr()?.port();
        let mut listeners = vec![lead];
        let mut is_complete = true;
        for other in &offered[1..] {
            match TcpListener::bind((other.ip, port)).await {
                Ok(listener) => listeners.push(listener),
                Err(_) => {
                    is_complete = false;
                    break;
                }
            }
        }
        if is_complete {
            return Ok((listeners, port));
        }
    }
    Err(BridgeError::NoPrivateNetwork)
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
