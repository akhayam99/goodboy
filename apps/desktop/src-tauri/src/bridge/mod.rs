mod action_guard;
mod advertise;
mod commands;
mod frame;
mod gate;
mod handshake;
mod identity;
mod listen;
mod network;
mod pairing;
mod permissions;
pub mod publish;
mod publish_schema;
mod server;
mod tokens;
mod vault;
#[cfg(test)]
mod wire_shape;

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex as StdMutex, OnceLock};

use base64::Engine as _;
use serde::Serialize;
use snow::params::NoiseParams;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, State};
use thiserror::Error;
use tokio::sync::{watch, Mutex};

use advertise::{fresh_instance_id, system_advertiser, Presence};
use commands::{CmdResult, PendingMap};
use handshake::RefusalCode;
use identity::{Identity, IdentityFault};
use listen::{bind_offered, endpoints_of};
use network::{interfaces_of, offered_addresses, raw_addresses, NetworkInterface};
use pairing::{PairingHold, PendingPairing};
use permissions::Permissions;
use publish::PublishHub;
use server::{serve, ServerCtx, Serving};
use tokens::TokenStore;
use vault::KeychainVault;

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
    #[error("protocol error: {0}")]
    Protocol(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    #[error("refused: {0}")]
    Refused(RefusalCode),
    #[error("no private network is offered to phones")]
    NoPrivateNetwork,
    #[error("the pairing identity is not available")]
    IdentityUnavailable,
}

impl BridgeError {
    fn kind(&self) -> &'static str {
        match self {
            BridgeError::NoHomeDir => "no_home_dir",
            BridgeError::Noise(_) => "noise",
            BridgeError::Decode(_) => "decode",
            BridgeError::Io(_) => "io",
            BridgeError::Json(_) => "json",
            BridgeError::Protocol(_) => "protocol",
            BridgeError::Unauthorized(_) => "unauthorized",
            BridgeError::Refused(_) => "refused",
            BridgeError::NoPrivateNetwork => "no_private_network",
            BridgeError::IdentityUnavailable => "identity_unavailable",
        }
    }
}

crate::util::impl_error_serialize!(BridgeError);

pub struct BridgeState {
    identity: Arc<Mutex<Identity>>,
    tokens: Arc<TokenStore>,
    pending: PendingMap,
    pairing: Arc<PairingHold>,
    app: Arc<OnceLock<AppHandle>>,
    instance: String,
    pub(crate) hub: Arc<PublishHub>,
    inner: Mutex<Inner>,
}

#[derive(Default)]
struct Inner {
    port: Option<u16>,
    task: Option<JoinHandle<()>>,
    shutdown: Option<watch::Sender<bool>>,
    selected: Option<Vec<String>>,
    presence: Option<Arc<StdMutex<Presence>>>,
}

fn offered_ips(selected: Option<&[String]>) -> Vec<IpAddr> {
    offered_addresses(&raw_addresses(), selected)
        .into_iter()
        .map(|a| a.ip)
        .collect()
}

impl BridgeState {
    pub fn new() -> Self {
        let identity = Identity::load_or_create();
        let app: Arc<OnceLock<AppHandle>> = Arc::new(OnceLock::new());
        let heard = app.clone();
        let pairing = PairingHold::new(Box::new(move |pending| {
            if let Some(handle) = heard.get() {
                let _ = handle.emit("bridge://pairing-request", pending);
            }
        }));
        Self {
            identity: Arc::new(Mutex::new(identity)),
            tokens: Arc::new(TokenStore::new()),
            pending: Arc::new(Mutex::new(HashMap::new())),
            pairing: Arc::new(pairing),
            app,
            instance: fresh_instance_id(),
            hub: Arc::new(PublishHub::new()),
            inner: Mutex::new(Inner::default()),
        }
    }

    async fn ensure_running(&self, app: AppHandle) -> Result<(u16, Vec<IpAddr>), BridgeError> {
        let _ = self.app.set(app.clone());
        let mut inner = self.inner.lock().await;
        let (selected, preferred, device_name) = {
            let mut id = self.identity.lock().await;
            id.try_recover(&KeychainVault);
            if id.fault().is_some() {
                return Err(BridgeError::IdentityUnavailable);
            }
            (id.interfaces.clone(), id.listen_port, id.device_label())
        };
        if let Some(port) = inner.port {
            if inner.selected == selected {
                return Ok((port, offered_ips(selected.as_deref())));
            }
            stop_inner(&mut inner);
        }
        let raw = offered_addresses(&raw_addresses(), selected.as_deref());
        let ips: Vec<IpAddr> = raw.iter().map(|a| a.ip).collect();
        let listening = bind_offered(&ips, preferred).await?;
        let port = listening.port;
        if let Err(error) = self.identity.lock().await.set_listen_port(port) {
            log::warn!("[bridge] could not remember the port: {error}");
        }
        let (shutdown_tx, shutdown_rx) = watch::channel(false);
        let ctx = Arc::new(ServerCtx {
            identity: self.identity.clone(),
            tokens: self.tokens.clone(),
            device_name,
            port,
            offered: Arc::new(std::sync::RwLock::new(ips.clone())),
            pairing: self.pairing.clone(),
            app,
            pending: self.pending.clone(),
            hub: self.hub.clone(),
            in_flight: Default::default(),
            shutdown: shutdown_rx,
        });
        let presence = Arc::new(StdMutex::new(Presence::start(
            system_advertiser(),
            self.instance.clone(),
            port,
            raw,
        )));
        let serving = Serving {
            port,
            first: listening.listeners,
            selected: selected.clone(),
            presence: presence.clone(),
        };
        let task = tauri::async_runtime::spawn(async move {
            serve(serving, ctx).await;
        });
        inner.port = Some(port);
        inner.task = Some(task);
        inner.shutdown = Some(shutdown_tx);
        inner.selected = selected.clone();
        inner.presence = Some(presence);
        Ok((port, ips))
    }

    async fn stop(&self) {
        self.pairing.cancel();
        stop_inner(&mut *self.inner.lock().await);
    }

    async fn has_phones(&self) -> bool {
        !self.identity.lock().await.phones.is_empty()
    }
}

impl Default for BridgeState {
    fn default() -> Self {
        Self::new()
    }
}

fn stop_inner(inner: &mut Inner) {
    if let Some(shutdown) = inner.shutdown.take() {
        let _ = shutdown.send(true);
    }
    if let Some(task) = inner.task.take() {
        task.abort();
    }
    if let Some(presence) = inner.presence.take() {
        if let Ok(mut presence) = presence.lock() {
            presence.stop();
        }
    }
    inner.port = None;
    inner.selected = None;
}

pub async fn resume(app: AppHandle, state: &BridgeState) {
    if !state.has_phones().await {
        return;
    }
    match state.ensure_running(app).await {
        Ok((port, _)) => log::info!("[bridge] listening for paired iPhones on port {port}"),
        Err(error) => log::warn!("[bridge] could not listen at launch: {error}"),
    }
}

pub const QR_VERSION: u8 = 2;

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
pub struct BridgeFault {
    code: &'static str,
    message: &'static str,
}

fn fault_view(fault: Option<IdentityFault>) -> Option<BridgeFault> {
    fault.map(|f| BridgeFault {
        code: f.wire(),
        message: f.message(),
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeStatus {
    running: bool,
    port: Option<u16>,
    enrolled_count: usize,
    is_advertised: bool,
    pending_pairing: Option<PendingPairing>,
    fault: Option<BridgeFault>,
}

#[tauri::command]
pub async fn bridge_start(
    app: AppHandle,
    state: State<'_, BridgeState>,
) -> Result<QrInfo, BridgeError> {
    let (port, offered) = state.ensure_running(app).await?;
    let endpoints = endpoints_of(&offered, port);
    if endpoints.is_empty() {
        if !state.has_phones().await {
            state.stop().await;
        }
        return Err(BridgeError::NoPrivateNetwork);
    }
    let token = state.tokens.mint();
    let (device_name, static_pub) = {
        let id = state.identity.lock().await;
        (id.device_label(), id.static_pub_b64.clone())
    };

    let payload = QrPayload {
        v: QR_VERSION,
        device_name: device_name.clone(),
        static_pub,
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
) -> Result<Vec<String>, BridgeError> {
    let rules = {
        let mut id = state.identity.lock().await;
        let rules = id.rules_of(&phone_id);
        id.revoke_one(&phone_id)?;
        rules
    };
    if !state.has_phones().await {
        state.stop().await;
    }
    Ok(rules)
}

#[tauri::command]
pub async fn bridge_note_phone_rule(
    state: State<'_, BridgeState>,
    phone_id: String,
    rule_id: String,
) -> Result<bool, BridgeError> {
    state.identity.lock().await.note_rule(&phone_id, &rule_id)
}

#[tauri::command]
pub async fn bridge_revoke(state: State<'_, BridgeState>) -> Result<Vec<String>, BridgeError> {
    let rules = {
        let mut id = state.identity.lock().await;
        let rules = id.all_rules();
        id.revoke_all()?;
        rules
    };
    state.stop().await;
    Ok(rules)
}

#[tauri::command]
pub async fn bridge_stop(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    if !state.has_phones().await {
        state.stop().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn bridge_pairing_decide(
    state: State<'_, BridgeState>,
    id: String,
    is_allowed: bool,
) -> Result<bool, BridgeError> {
    Ok(state.pairing.decide(&id, is_allowed))
}

#[tauri::command]
pub async fn bridge_reset_pairing(state: State<'_, BridgeState>) -> Result<(), BridgeError> {
    state.stop().await;
    state.identity.lock().await.reset_pairing(&KeychainVault)?;
    Ok(())
}

#[tauri::command]
pub async fn bridge_status(state: State<'_, BridgeState>) -> Result<BridgeStatus, BridgeError> {
    let (running, port, is_advertised) = {
        let inner = state.inner.lock().await;
        let is_advertised = inner
            .presence
            .as_ref()
            .and_then(|p| p.lock().ok().map(|p| p.is_up()))
            .unwrap_or(false);
        (inner.port.is_some(), inner.port, is_advertised)
    };
    let (enrolled_count, fault) = {
        let mut id = state.identity.lock().await;
        id.try_recover(&KeychainVault);
        (id.phones.len(), id.fault())
    };
    Ok(BridgeStatus {
        running,
        port,
        enrolled_count,
        is_advertised,
        pending_pairing: state.pairing.pending(),
        fault: fault_view(fault),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_mac_hostname_is_never_read_for_the_qr_or_the_hello() {
        let source = include_str!("mod.rs");
        assert!(!source.contains(concat!("gethost", "name")));
    }

    #[test]
    fn stopping_the_listener_clears_its_running_state() {
        let mut inner = Inner {
            port: Some(49160),
            selected: Some(vec!["en0".into()]),
            ..Inner::default()
        };

        stop_inner(&mut inner);

        assert_eq!(inner.port, None);
        assert_eq!(inner.selected, None);
    }
}
