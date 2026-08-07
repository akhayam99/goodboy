use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tokio::sync::watch;

use crate::path_env;

const DETECT_TIMEOUT: Duration = Duration::from_secs(2);
const AUTH_TIMEOUT: Duration = Duration::from_secs(5);
const CODEX_AUTH_TIMEOUT: Duration = Duration::from_secs(8);
const POLL_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ProviderStatus {
    pub id: String,
    pub binary: String,
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

pub struct ProviderState(pub Mutex<ProviderStatus>);

pub struct CursorState(pub Mutex<ProviderStatus>);

pub struct CodexState(pub Mutex<ProviderStatus>);

pub struct GeminiState(pub Mutex<ProviderStatus>);

pub struct OpencodeState(pub Mutex<ProviderStatus>);

pub struct DetectionGate(watch::Receiver<bool>);

pub struct DetectionGateOpener(watch::Sender<bool>);

pub fn detection_gate() -> (DetectionGate, DetectionGateOpener) {
    let (tx, rx) = watch::channel(false);
    (DetectionGate(rx), DetectionGateOpener(tx))
}

impl DetectionGate {
    pub async fn wait(&self) {
        let mut rx = self.0.clone();
        loop {
            if *rx.borrow_and_update() {
                return;
            }
            if rx.changed().await.is_err() {
                return;
            }
        }
    }
}

impl DetectionGateOpener {
    pub fn open(self) {
        let _ = self.0.send(true);
    }
}

pub fn initial_status(id: &str, binary: &str) -> ProviderStatus {
    ProviderStatus {
        id: id.to_string(),
        binary: binary.to_string(),
        available: false,
        version: None,
        error: None,
    }
}

#[derive(Debug, Clone)]
pub struct DetectedProviders {
    pub claude: ProviderStatus,
    pub cursor: ProviderStatus,
    pub codex: ProviderStatus,
    pub gemini: ProviderStatus,
    pub opencode: ProviderStatus,
}

type Detector = fn() -> ProviderStatus;

#[derive(Clone, Copy)]
struct Detectors {
    claude: Detector,
    cursor: Detector,
    codex: Detector,
    gemini: Detector,
    opencode: Detector,
}

const DEFAULT_DETECTORS: Detectors = Detectors {
    claude: detect_claude,
    cursor: detect_cursor,
    codex: detect_codex,
    gemini: detect_gemini,
    opencode: detect_opencode,
};

async fn detect_isolated(detect: Detector, id: &'static str, binary: &'static str) -> ProviderStatus {
    tauri::async_runtime::spawn_blocking(detect)
        .await
        .unwrap_or_else(|err| ProviderStatus {
            id: id.to_string(),
            binary: binary.to_string(),
            available: false,
            version: None,
            error: Some(err.to_string()),
        })
}

async fn detect_all_with(detectors: Detectors) -> DetectedProviders {
    let (claude, cursor, codex, gemini, opencode) = tokio::join!(
        detect_isolated(detectors.claude, "anthropic", "claude"),
        detect_isolated(detectors.cursor, "cursor", "cursor-agent"),
        detect_isolated(detectors.codex, "codex", "codex"),
        detect_isolated(detectors.gemini, "gemini", "agy"),
        detect_isolated(detectors.opencode, "opencode", "opencode"),
    );
    DetectedProviders {
        claude,
        cursor,
        codex,
        gemini,
        opencode,
    }
}

pub async fn detect_all() -> DetectedProviders {
    detect_all_with(DEFAULT_DETECTORS).await
}

pub fn spawn_startup_detection(app: AppHandle, opener: DetectionGateOpener) {
    tauri::async_runtime::spawn(async move {
        let detected = detect_all().await;
        store_detected(&app, detected);
        opener.open();
    });
}

fn store_detected(app: &AppHandle, detected: DetectedProviders) {
    store_status(&app.state::<ProviderState>().0, detected.claude);
    store_status(&app.state::<CursorState>().0, detected.cursor);
    store_status(&app.state::<CodexState>().0, detected.codex);
    store_status(&app.state::<GeminiState>().0, detected.gemini);
    store_status(&app.state::<OpencodeState>().0, detected.opencode);
}

fn store_status(state: &Mutex<ProviderStatus>, next: ProviderStatus) {
    if let Ok(mut current) = state.lock() {
        *current = next;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AuthStateKind {
    Connected,
    Disconnected,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuthState {
    pub state: AuthStateKind,
    pub identity: Option<String>,
}

pub fn detect_claude() -> ProviderStatus {
    detect_binary("anthropic", "claude")
}

pub fn detect_cursor() -> ProviderStatus {
    detect_binary("cursor", "cursor-agent")
}

pub fn detect_codex() -> ProviderStatus {
    detect_binary("codex", "codex")
}

pub fn detect_gemini() -> ProviderStatus {
    detect_binary("gemini", "agy")
}

pub fn detect_opencode() -> ProviderStatus {
    detect_binary("opencode", "opencode")
}

fn detect_binary(id: &str, binary: &str) -> ProviderStatus {
    let mut child = match path_env::command(binary)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(err) => {
            return ProviderStatus {
                id: id.to_string(),
                binary: binary.to_string(),
                available: false,
                version: None,
                error: Some(err.to_string()),
            };
        }
    };

    let deadline = Instant::now() + DETECT_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let stdout = child
                    .stdout
                    .take()
                    .map(read_to_string)
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                if status.success() {
                    return ProviderStatus {
                        id: id.to_string(),
                        binary: binary.to_string(),
                        available: true,
                        version: Some(stdout),
                        error: None,
                    };
                } else {
                    return ProviderStatus {
                        id: id.to_string(),
                        binary: binary.to_string(),
                        available: false,
                        version: None,
                        error: Some(format!("exited with code {}", status.code().unwrap_or(-1))),
                    };
                }
            }
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    return ProviderStatus {
                        id: id.to_string(),
                        binary: binary.to_string(),
                        available: false,
                        version: None,
                        error: Some("detection timed out".to_string()),
                    };
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(err) => {
                return ProviderStatus {
                    id: id.to_string(),
                    binary: binary.to_string(),
                    available: false,
                    version: None,
                    error: Some(err.to_string()),
                };
            }
        }
    }
}

fn read_to_string<R: std::io::Read>(mut reader: R) -> String {
    let mut buf = String::new();
    let _ = reader.read_to_string(&mut buf);
    buf
}

pub struct AuthCommandOutput {
    pub stdout: String,
    pub stderr: String,
}

impl AuthCommandOutput {
    /// codex CLI v0.130 writes `codex login status` to stderr in non-TTY mode
    /// (and Tauri children never have a TTY) — fall back when stdout is empty.
    fn primary_text(&self) -> &str {
        if self.stdout.trim().is_empty() {
            &self.stderr
        } else {
            &self.stdout
        }
    }
}

fn run_auth_command(args: &[&str]) -> Result<AuthCommandOutput, String> {
    run_auth_command_until(args, Instant::now() + AUTH_TIMEOUT)
}

fn run_auth_command_until(args: &[&str], deadline: Instant) -> Result<AuthCommandOutput, String> {
    let (binary, rest) = args
        .split_first()
        .ok_or_else(|| "empty command".to_string())?;
    let mut child = path_env::command(binary)
        .args(rest)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let stdout = child
                    .stdout
                    .take()
                    .map(read_to_string)
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                let stderr = child
                    .stderr
                    .take()
                    .map(read_to_string)
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                if status.success() {
                    return Ok(AuthCommandOutput { stdout, stderr });
                } else {
                    let msg = if stderr.is_empty() { stdout } else { stderr };
                    return Err(msg);
                }
            }
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    return Err("auth check timed out".to_string());
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}

fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' && chars.peek() == Some(&'[') {
            chars.next();
            while let Some(&nc) = chars.peek() {
                chars.next();
                if nc.is_ascii_alphabetic() {
                    break;
                }
            }
            continue;
        }
        out.push(c);
    }
    out
}

fn extract_json_string(json: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\"", key);
    let pos = json.find(&needle)?;
    let after_key = &json[pos + needle.len()..];
    let colon = after_key.find(':')? + 1;
    let after_colon = after_key[colon..].trim_start();
    if !after_colon.starts_with('"') {
        return None;
    }
    let inner = &after_colon[1..];
    let end = inner.find('"')?;
    let value = &inner[..end];
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn extract_email(text: &str) -> Option<String> {
    for word in text.split_whitespace() {
        let w = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '@' && c != '.');
        if w.contains('@') && w.contains('.') {
            return Some(w.to_string());
        }
    }
    None
}

/// base64url decoder (no padding, URL-safe alphabet). std-only.
fn base64url_decode(s: &str) -> Option<Vec<u8>> {
    let lookup = |c: u8| -> Option<u32> {
        match c {
            b'A'..=b'Z' => Some((c - b'A') as u32),
            b'a'..=b'z' => Some((c - b'a' + 26) as u32),
            b'0'..=b'9' => Some((c - b'0' + 52) as u32),
            b'-' => Some(62),
            b'_' => Some(63),
            _ => None,
        }
    };
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    for c in s.bytes() {
        let v = lookup(c)?;
        buf = (buf << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    Some(out)
}

/// Decode a JWT payload (`header.payload.signature`) and return the `email`
/// claim. Codex stores its ChatGPT-login id_token in `~/.codex/auth.json`,
/// which is the only carrier of the user's email when `codex login status`
/// outputs a generic "Logged in using ChatGPT" line.
fn extract_email_from_id_token(token: &str) -> Option<String> {
    let payload_b64 = token.split('.').nth(1)?;
    let payload_bytes = base64url_decode(payload_b64)?;
    let payload: serde_json::Value = serde_json::from_slice(&payload_bytes).ok()?;
    payload
        .get("email")
        .and_then(|v| v.as_str())
        .map(String::from)
}

fn extract_codex_identity_from_auth_json() -> Option<String> {
    let path = dirs::home_dir()?.join(".codex/auth.json");
    let content = std::fs::read_to_string(path).ok()?;
    let root: serde_json::Value = serde_json::from_str(&content).ok()?;
    let id_token = root.get("tokens")?.get("id_token")?.as_str()?;
    extract_email_from_id_token(id_token)
}

fn check_claude_auth() -> AuthState {
    match run_auth_command(&["claude", "auth", "status"]) {
        Ok(out) => parse_claude_auth_output(&out.stdout),
        Err(_) => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

fn parse_claude_auth_output(output: &str) -> AuthState {
    let value: serde_json::Value = match serde_json::from_str(output) {
        Ok(v) => v,
        Err(_) => {
            return AuthState {
                state: AuthStateKind::Unknown,
                identity: None,
            };
        }
    };

    if value.get("loggedIn").and_then(|v| v.as_bool()) != Some(true) {
        return AuthState {
            state: AuthStateKind::Disconnected,
            identity: None,
        };
    }

    let identity = ["email", "username", "accountName"]
        .iter()
        .find_map(|k| value.get(k).and_then(|v| v.as_str()).map(|s| s.to_string()));
    AuthState {
        state: AuthStateKind::Connected,
        identity,
    }
}

fn check_cursor_auth() -> AuthState {
    match run_auth_command(&["cursor-agent", "status"]) {
        // Use primary_text() so a non-TTY child that writes status to stderr is
        // still read (cursor-agent, like codex, can route to stderr headless).
        Ok(out) => parse_cursor_auth_output(out.primary_text()),
        Err(_) => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

fn parse_cursor_auth_output(output: &str) -> AuthState {
    let stripped = strip_ansi(output);
    let text = stripped.trim();
    if text.is_empty() {
        return AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        };
    }
    let lower = text.to_lowercase();
    // Negative checks first: a "not logged in" line must never be read as positive.
    if lower.contains("not logged in")
        || lower.contains("not authenticated")
        || lower.contains("not signed in")
        || lower.contains("logged out")
    {
        return AuthState {
            state: AuthStateKind::Disconnected,
            identity: None,
        };
    }
    let identity = extract_email(text)
        .or_else(|| extract_json_string(text, "email"))
        .or_else(|| extract_json_string(text, "username"));
    // Only Connected on a positive signal (an identity or an explicit logged-in
    // phrase). Unrecognized/empty output stays Unknown instead of silently
    // reporting "connected" — the previous code fell through to Connected and
    // showed a logged-out cursor as authenticated.
    let positive = identity.is_some()
        || lower.contains("logged in")
        || lower.contains("signed in")
        || lower.contains("authenticated as");
    if positive {
        AuthState {
            state: AuthStateKind::Connected,
            identity,
        }
    } else {
        AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        }
    }
}

fn check_codex_auth() -> AuthState {
    // Subcommand layout shifted across codex versions; try most recent first.
    let candidates: &[&[&str]] = &[
        &["codex", "login", "status"],
        &["codex", "auth", "status"],
        &["codex", "auth", "whoami"],
        &["codex", "whoami"],
        &["codex", "status"],
    ];
    let deadline = Instant::now() + CODEX_AUTH_TIMEOUT;
    for cmd in candidates {
        let now = Instant::now();
        if now >= deadline {
            break;
        }
        let command_deadline = std::cmp::min(now + AUTH_TIMEOUT, deadline);
        if let Ok(out) = run_auth_command_until(cmd, command_deadline) {
            let text = out.primary_text();
            if text.trim().is_empty() {
                continue;
            }
            return parse_codex_auth_output(text);
        }
    }
    AuthState {
        state: AuthStateKind::Unknown,
        identity: None,
    }
}

fn gemini_creds_dir() -> Option<std::path::PathBuf> {
    Some(dirs::home_dir()?.join(".gemini/antigravity-cli"))
}

fn extract_gemini_identity_from_creds() -> Option<String> {
    let dir = gemini_creds_dir()?;
    for entry in std::fs::read_dir(&dir).ok()?.flatten() {
        let Ok(content) = std::fs::read_to_string(entry.path()) else {
            continue;
        };
        let Ok(root) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };
        if let Some(email) = root.get("email").and_then(|v| v.as_str()) {
            return Some(email.to_string());
        }
        if let Some(id_token) = root.get("id_token").and_then(|v| v.as_str()) {
            if let Some(email) = extract_email_from_id_token(id_token) {
                return Some(email);
            }
        }
    }
    None
}

fn gemini_creds_present() -> bool {
    gemini_creds_dir()
        .and_then(|d| std::fs::read_dir(d).ok())
        .map(|mut entries| entries.any(|e| e.is_ok()))
        .unwrap_or(false)
}

fn check_gemini_auth() -> AuthState {
    // antigravity (`agy`) persists session state under `~/.gemini/antigravity-cli/`
    // after a successful login and clears it on logout, so the directory is the
    // ground truth. Read it directly: fast, accurate, no interactive subprocess.
    // API-key auth (GEMINI_API_KEY) leaves no creds dir and is surfaced as
    // connected by the credential layer instead.
    if let Some(identity) = extract_gemini_identity_from_creds() {
        return AuthState {
            state: AuthStateKind::Connected,
            identity: Some(identity),
        };
    }
    if gemini_creds_present() {
        return AuthState {
            state: AuthStateKind::Connected,
            identity: None,
        };
    }
    AuthState {
        state: AuthStateKind::Disconnected,
        identity: None,
    }
}

const OPENCODE_BOX_CHARS: &[char] = &['┌', '│', '└', '├', '┐', '┘', '─', '●', '○', '◆', '◇'];

fn opencode_row_label(line: &str) -> String {
    line.split('\u{1b}')
        .next()
        .unwrap_or("")
        .trim_matches(|c: char| c.is_whitespace() || OPENCODE_BOX_CHARS.contains(&c))
        .to_string()
}

fn parse_opencode_credentials(output: &str) -> Vec<String> {
    let mut in_section = false;
    let mut names = Vec::new();
    for line in output.lines() {
        let label = opencode_row_label(line);
        if label.is_empty() {
            continue;
        }
        let lower = label.to_lowercase();
        if !in_section {
            if lower.starts_with("credentials") {
                in_section = true;
            }
            continue;
        }
        if lower.ends_with("credentials") || lower.ends_with("credential") {
            break;
        }
        names.push(label);
    }
    names
}

fn check_opencode_auth() -> AuthState {
    match run_auth_command(&["opencode", "auth", "list"]) {
        Ok(out) => {
            let names = parse_opencode_credentials(out.primary_text());
            if names.is_empty() {
                return AuthState {
                    state: AuthStateKind::Disconnected,
                    identity: None,
                };
            }
            AuthState {
                state: AuthStateKind::Connected,
                identity: Some(names.join(", ")),
            }
        }
        Err(_) => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

fn openrouter_credential(names: &[String]) -> Option<&String> {
    names
        .iter()
        .find(|name| name.to_lowercase().replace(' ', "").contains("openrouter"))
}

fn moonshot_credential(names: &[String]) -> Option<&String> {
    names
        .iter()
        .find(|name| name.to_lowercase().replace(' ', "").contains("moonshot"))
}

fn check_openrouter_auth() -> AuthState {
    match run_auth_command(&["opencode", "auth", "list"]) {
        Ok(out) => {
            let names = parse_opencode_credentials(out.primary_text());
            match openrouter_credential(&names) {
                Some(name) => AuthState {
                    state: AuthStateKind::Connected,
                    identity: Some(name.clone()),
                },
                None => AuthState {
                    state: AuthStateKind::Disconnected,
                    identity: None,
                },
            }
        }
        Err(_) => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

fn check_moonshot_auth() -> AuthState {
    match run_auth_command(&["opencode", "auth", "list"]) {
        Ok(out) => {
            let names = parse_opencode_credentials(out.primary_text());
            match moonshot_credential(&names) {
                Some(name) => AuthState {
                    state: AuthStateKind::Connected,
                    identity: Some(name.clone()),
                },
                None => AuthState {
                    state: AuthStateKind::Disconnected,
                    identity: None,
                },
            }
        }
        Err(_) => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

fn parse_codex_auth_output(output: &str) -> AuthState {
    let stripped: String = strip_ansi(output);
    let first_line = stripped
        .lines()
        .map(|l| l.trim())
        .find(|l| !l.is_empty())
        .unwrap_or("");
    let lower = first_line.to_lowercase();

    // Disconnected before Connected: "you are not logged in" would match both.
    if lower.starts_with("not logged")
        || lower.starts_with("not signed")
        || lower.contains("not logged in")
        || lower.contains("not signed in")
        || lower.contains("unauthenticated")
        || lower.contains("no credentials")
    {
        return AuthState {
            state: AuthStateKind::Disconnected,
            identity: None,
        };
    }
    if lower.starts_with("logged in")
        || lower.starts_with("signed in")
        || lower.starts_with("you are logged in")
        || lower.contains("authenticated as")
        || extract_email(first_line).is_some()
    {
        let identity = extract_email(first_line)
            .or_else(|| extract_json_string(output, "email"))
            .or_else(|| extract_json_string(output, "username"))
            .or_else(extract_codex_identity_from_auth_json);
        return AuthState {
            state: AuthStateKind::Connected,
            identity,
        };
    }

    AuthState {
        state: AuthStateKind::Unknown,
        identity: None,
    }
}

#[tauri::command]
pub async fn get_provider_status(
    gate: State<'_, DetectionGate>,
    state: State<'_, ProviderState>,
) -> Result<ProviderStatus, String> {
    gate.wait().await;
    Ok(get_status(&state.0, "anthropic", "claude"))
}

#[tauri::command]
pub async fn refresh_provider_status(
    state: State<'_, ProviderState>,
) -> Result<ProviderStatus, String> {
    refresh_status(&state.0, detect_claude).await
}

#[tauri::command]
pub async fn get_cursor_status(
    gate: State<'_, DetectionGate>,
    state: State<'_, CursorState>,
) -> Result<ProviderStatus, String> {
    gate.wait().await;
    Ok(get_status(&state.0, "cursor", "cursor-agent"))
}

#[tauri::command]
pub async fn refresh_cursor_status(
    state: State<'_, CursorState>,
) -> Result<ProviderStatus, String> {
    refresh_status(&state.0, detect_cursor).await
}

#[tauri::command]
pub async fn get_codex_status(
    gate: State<'_, DetectionGate>,
    state: State<'_, CodexState>,
) -> Result<ProviderStatus, String> {
    gate.wait().await;
    Ok(get_status(&state.0, "codex", "codex"))
}

#[tauri::command]
pub async fn refresh_codex_status(state: State<'_, CodexState>) -> Result<ProviderStatus, String> {
    refresh_status(&state.0, detect_codex).await
}

#[tauri::command]
pub async fn get_gemini_status(
    gate: State<'_, DetectionGate>,
    state: State<'_, GeminiState>,
) -> Result<ProviderStatus, String> {
    gate.wait().await;
    Ok(get_status(&state.0, "gemini", "agy"))
}

#[tauri::command]
pub async fn refresh_gemini_status(
    state: State<'_, GeminiState>,
) -> Result<ProviderStatus, String> {
    refresh_status(&state.0, detect_gemini).await
}

#[tauri::command]
pub async fn get_opencode_status(
    gate: State<'_, DetectionGate>,
    state: State<'_, OpencodeState>,
) -> Result<ProviderStatus, String> {
    gate.wait().await;
    Ok(get_status(&state.0, "opencode", "opencode"))
}

#[tauri::command]
pub async fn get_openrouter_status(
    gate: State<'_, DetectionGate>,
    state: State<'_, OpencodeState>,
) -> Result<ProviderStatus, String> {
    gate.wait().await;
    Ok(aliased(
        get_status(&state.0, "openrouter", "opencode"),
        "openrouter",
    ))
}

#[tauri::command]
pub async fn get_moonshot_status(
    gate: State<'_, DetectionGate>,
    state: State<'_, OpencodeState>,
) -> Result<ProviderStatus, String> {
    gate.wait().await;
    Ok(aliased(
        get_status(&state.0, "moonshot", "opencode"),
        "moonshot",
    ))
}

fn aliased(status: ProviderStatus, id: &str) -> ProviderStatus {
    ProviderStatus {
        id: id.to_string(),
        ..status
    }
}

#[tauri::command]
pub async fn refresh_openrouter_status(
    state: State<'_, OpencodeState>,
) -> Result<ProviderStatus, String> {
    let mut status = refresh_status(&state.0, detect_opencode).await?;
    status.id = "openrouter".to_string();
    Ok(status)
}

#[tauri::command]
pub async fn refresh_moonshot_status(
    state: State<'_, OpencodeState>,
) -> Result<ProviderStatus, String> {
    let mut status = refresh_status(&state.0, detect_opencode).await?;
    status.id = "moonshot".to_string();
    Ok(status)
}

#[tauri::command]
pub async fn refresh_opencode_status(
    state: State<'_, OpencodeState>,
) -> Result<ProviderStatus, String> {
    refresh_status(&state.0, detect_opencode).await
}

fn get_status(state: &Mutex<ProviderStatus>, id: &str, binary: &str) -> ProviderStatus {
    state
        .lock()
        .map(|s| s.clone())
        .unwrap_or_else(|_| ProviderStatus {
            id: id.to_string(),
            binary: binary.to_string(),
            available: false,
            version: None,
            error: Some("status mutex poisoned".to_string()),
        })
}

async fn refresh_status(
    state: &Mutex<ProviderStatus>,
    detect: fn() -> ProviderStatus,
) -> Result<ProviderStatus, String> {
    let next = tauri::async_runtime::spawn_blocking(detect)
        .await
        .map_err(|err| err.to_string())?;
    if let Ok(mut current) = state.lock() {
        *current = next.clone();
    }
    Ok(next)
}

// Sync entry point for callers that already run on a blocking thread (e.g.
// the lifecycle PTY exit handler in provider_lifecycle.rs). Kept private so
// only the async Tauri command shape leaks into the JS surface.
pub(crate) fn check_provider_auth_blocking(provider_id: &str) -> AuthState {
    match provider_id {
        "anthropic" => check_claude_auth(),
        "cursor" => check_cursor_auth(),
        "codex" => check_codex_auth(),
        "gemini" => check_gemini_auth(),
        "opencode" => check_opencode_auth(),
        "openrouter" => check_openrouter_auth(),
        "moonshot" => check_moonshot_auth(),
        _ => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

// Async wrapper so Tauri schedules this on the async runtime and the
// process-spawning work runs on a blocking thread instead of stalling the
// main IPC thread. Without this, four parallel refreshProviders() auth
// checks serialize on the main thread and freeze every other IPC call.
#[tauri::command]
pub async fn check_provider_auth(provider_id: String) -> AuthState {
    tauri::async_runtime::spawn_blocking(move || check_provider_auth_blocking(&provider_id))
        .await
        .unwrap_or(AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_parses_logged_in_json() {
        let json = r#"{"loggedIn":true,"authMethod":"claude.ai","email":"a@b.com"}"#;
        let s = parse_claude_auth_output(json);
        assert_eq!(s.state, AuthStateKind::Connected);
        assert_eq!(s.identity.as_deref(), Some("a@b.com"));
    }

    #[test]
    fn claude_parses_logged_out_json() {
        let s = parse_claude_auth_output(r#"{"loggedIn":false}"#);
        assert_eq!(s.state, AuthStateKind::Disconnected);
        assert_eq!(s.identity, None);
    }

    #[test]
    fn claude_returns_unknown_on_non_json() {
        let s = parse_claude_auth_output("garbage not json");
        assert_eq!(s.state, AuthStateKind::Unknown);
    }

    #[test]
    fn claude_falls_back_to_username_when_email_missing() {
        let json = r#"{"loggedIn":true,"username":"alice"}"#;
        let s = parse_claude_auth_output(json);
        assert_eq!(s.state, AuthStateKind::Connected);
        assert_eq!(s.identity.as_deref(), Some("alice"));
    }

    #[test]
    fn codex_logged_in_with_chatgpt() {
        let s = parse_codex_auth_output("Logged in using ChatGPT\n");
        assert_eq!(s.state, AuthStateKind::Connected);
    }

    #[test]
    fn codex_logged_in_with_api_key() {
        let s = parse_codex_auth_output("Logged in using API key\n");
        assert_eq!(s.state, AuthStateKind::Connected);
    }

    #[test]
    fn codex_not_logged_in() {
        let s = parse_codex_auth_output("Not logged in\n");
        assert_eq!(s.state, AuthStateKind::Disconnected);
    }

    #[test]
    fn codex_handles_ansi_escapes() {
        let s = parse_codex_auth_output("\u{1b}[1mLogged in using ChatGPT\u{1b}[0m\n");
        assert_eq!(s.state, AuthStateKind::Connected);
    }

    #[test]
    fn codex_extracts_email_when_present() {
        let s = parse_codex_auth_output("Logged in as alice@example.com\n");
        assert_eq!(s.state, AuthStateKind::Connected);
        assert_eq!(s.identity.as_deref(), Some("alice@example.com"));
    }

    #[test]
    fn codex_returns_unknown_on_unrecognized() {
        let s = parse_codex_auth_output("whatever new wording\n");
        assert_eq!(s.state, AuthStateKind::Unknown);
    }

    #[test]
    fn codex_ignores_leading_blank_lines() {
        let s = parse_codex_auth_output("\n\n  \nLogged in using ChatGPT\n");
        assert_eq!(s.state, AuthStateKind::Connected);
    }

    fn base64url_encode(bytes: &[u8]) -> String {
        const ALPHA: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        let mut out = String::with_capacity(bytes.len() * 4 / 3 + 4);
        let mut buf: u32 = 0;
        let mut bits: u32 = 0;
        for &b in bytes {
            buf = (buf << 8) | b as u32;
            bits += 8;
            while bits >= 6 {
                bits -= 6;
                out.push(ALPHA[((buf >> bits) & 0x3f) as usize] as char);
            }
        }
        if bits > 0 {
            out.push(ALPHA[((buf << (6 - bits)) & 0x3f) as usize] as char);
        }
        out
    }

    #[test]
    fn base64url_decode_roundtrip() {
        let payload = b"{\"email\":\"a@b.com\"}";
        let encoded = base64url_encode(payload);
        let decoded = super::base64url_decode(&encoded).unwrap();
        assert_eq!(decoded, payload);
    }

    #[test]
    fn extract_email_from_id_token_decodes_jwt_payload() {
        let header = base64url_encode(b"{\"alg\":\"RS256\"}");
        let payload = base64url_encode(b"{\"email\":\"alice@example.com\",\"sub\":\"x\"}");
        let token = format!("{}.{}.sig", header, payload);
        assert_eq!(
            super::extract_email_from_id_token(&token),
            Some("alice@example.com".to_string())
        );
    }

    #[test]
    fn extract_email_from_id_token_returns_none_on_garbage() {
        assert_eq!(super::extract_email_from_id_token("not-a-jwt"), None);
        assert_eq!(super::extract_email_from_id_token("x.&&.z"), None);
        let no_email = base64url_encode(b"{\"sub\":\"x\"}");
        let token = format!("h.{}.s", no_email);
        assert_eq!(super::extract_email_from_id_token(&token), None);
    }

    #[test]
    fn auth_output_prefers_stdout_when_present() {
        let out = AuthCommandOutput {
            stdout: "Logged in using API key (sk-…)\n".to_string(),
            stderr: String::new(),
        };
        assert_eq!(out.primary_text(), "Logged in using API key (sk-…)\n");
    }

    #[test]
    fn auth_output_falls_back_to_stderr_when_stdout_empty() {
        let out = AuthCommandOutput {
            stdout: String::new(),
            stderr: "Logged in using ChatGPT\n".to_string(),
        };
        assert_eq!(out.primary_text(), "Logged in using ChatGPT\n");
        let parsed = parse_codex_auth_output(out.primary_text());
        assert_eq!(parsed.state, AuthStateKind::Connected);
    }

    #[test]
    fn auth_output_uses_stdout_when_only_whitespace_on_stderr() {
        let out = AuthCommandOutput {
            stdout: "Logged in using ChatGPT\n".to_string(),
            stderr: "  \n".to_string(),
        };
        assert_eq!(out.primary_text(), "Logged in using ChatGPT\n");
    }

    #[test]
    fn auth_output_returns_empty_when_both_streams_empty() {
        let out = AuthCommandOutput {
            stdout: String::new(),
            stderr: String::new(),
        };
        assert!(out.primary_text().trim().is_empty());
    }

    #[test]
    fn cursor_not_logged_in_is_disconnected() {
        let s = parse_cursor_auth_output("Not logged in\n");
        assert_eq!(s.state, AuthStateKind::Disconnected);
    }

    #[test]
    fn cursor_empty_output_is_unknown_not_connected() {
        // Regression: empty/odd output used to fall through to Connected.
        let s = parse_cursor_auth_output("");
        assert_eq!(s.state, AuthStateKind::Unknown);
        let s2 = parse_cursor_auth_output("   \n  \n");
        assert_eq!(s2.state, AuthStateKind::Unknown);
    }

    #[test]
    fn cursor_unrecognized_output_is_unknown() {
        let s = parse_cursor_auth_output("some unexpected banner line\n");
        assert_eq!(s.state, AuthStateKind::Unknown);
    }

    #[test]
    fn cursor_logged_in_with_email_is_connected() {
        let s = parse_cursor_auth_output("Logged in as alice@example.com\n");
        assert_eq!(s.state, AuthStateKind::Connected);
        assert_eq!(s.identity.as_deref(), Some("alice@example.com"));
    }

    #[test]
    fn cursor_logged_in_phrase_without_identity_is_connected() {
        let s = parse_cursor_auth_output("Signed in\n");
        assert_eq!(s.state, AuthStateKind::Connected);
    }

    // Gemini auth is now creds-file-based (no subprocess), so the cli-output
    // parser is gone and unit-test coverage moved to the filesystem layer.
    // See extract_email_from_id_token tests below for the JWT decode path
    // that backs both gemini and codex on-disk identity recovery.

    const OPENCODE_EMPTY_LIST: &str = "\u{250c}  Credentials \u{1b}[90m~/.local/share/opencode/auth.json\n\u{2502}\n\u{2514}  0 credentials\n\n\u{250c}  Environment\n\u{2502}\n\u{25cf}  GitHub Copilot \u{1b}[90mGITHUB_TOKEN\n\u{2502}\n\u{2514}  1 environment variable\n";

    const OPENCODE_FILLED_LIST: &str = "\u{250c}  Credentials \u{1b}[90m~/.local/share/opencode/auth.json\n\u{2502}\n\u{25cf}  OpenRouter \u{1b}[90mapi\n\u{2502}\n\u{25cf}  Anthropic \u{1b}[90moauth\n\u{2502}\n\u{2514}  2 credentials\n\n\u{250c}  Environment\n\u{2502}\n\u{25cf}  GitHub Copilot \u{1b}[90mGITHUB_TOKEN\n\u{2502}\n\u{2514}  1 environment variable\n";

    #[test]
    fn opencode_reads_no_credentials_as_disconnected() {
        assert!(parse_opencode_credentials(OPENCODE_EMPTY_LIST).is_empty());
    }

    #[test]
    fn opencode_reads_credential_names_without_the_method_suffix() {
        let names = parse_opencode_credentials(OPENCODE_FILLED_LIST);
        assert_eq!(
            names,
            vec!["OpenRouter".to_string(), "Anthropic".to_string()]
        );
    }

    #[test]
    fn openrouter_ignores_environment_only_entries() {
        let names = parse_opencode_credentials(OPENCODE_EMPTY_LIST);
        assert!(openrouter_credential(&names).is_none());
    }

    #[test]
    fn moonshot_matches_only_its_own_credential_row() {
        let names = parse_opencode_credentials(OPENCODE_FILLED_LIST);
        assert!(moonshot_credential(&names).is_none());
        let with_moonshot = vec!["Moonshot AI".to_string(), "OpenRouter".to_string()];
        assert_eq!(
            moonshot_credential(&with_moonshot),
            Some(&"Moonshot AI".to_string())
        );
    }

    #[test]
    fn openrouter_matches_its_credential_row() {
        let names = parse_opencode_credentials(OPENCODE_FILLED_LIST);
        assert_eq!(
            openrouter_credential(&names),
            Some(&"OpenRouter".to_string())
        );
    }

    fn fake(id: &str) -> ProviderStatus {
        ProviderStatus {
            id: id.to_string(),
            binary: format!("{}-bin", id),
            available: true,
            version: Some(format!("{}-1.0", id)),
            error: None,
        }
    }

    const FAKE_DETECTORS: Detectors = Detectors {
        claude: || fake("anthropic"),
        cursor: || fake("cursor"),
        codex: || fake("codex"),
        gemini: || fake("gemini"),
        opencode: || fake("opencode"),
    };

    #[tokio::test]
    async fn gate_releases_waiters_once_opened() {
        let (gate, opener) = detection_gate();
        opener.open();
        gate.wait().await;
    }

    #[tokio::test]
    async fn gate_releases_waiters_when_the_task_panics() {
        let (gate, opener) = detection_gate();
        let task = tokio::spawn(async move {
            let _held = opener;
            panic!("detection task died");
        });
        assert!(task.await.is_err());
        gate.wait().await;
    }

    #[tokio::test]
    async fn gate_releases_waiters_when_the_opener_is_dropped_unused() {
        let (gate, opener) = detection_gate();
        drop(opener);
        gate.wait().await;
    }

    #[tokio::test]
    async fn concurrent_detection_routes_every_result_to_its_own_slot() {
        let detected = detect_all_with(FAKE_DETECTORS).await;
        assert_eq!(detected.claude.id, "anthropic");
        assert_eq!(detected.cursor.id, "cursor");
        assert_eq!(detected.codex.id, "codex");
        assert_eq!(detected.gemini.id, "gemini");
        assert_eq!(detected.opencode.id, "opencode");
        assert_eq!(detected.claude.version.as_deref(), Some("anthropic-1.0"));
        assert_eq!(detected.opencode.version.as_deref(), Some("opencode-1.0"));
    }

    #[tokio::test]
    async fn concurrent_detection_matches_the_serial_result() {
        let serial = DetectedProviders {
            claude: (FAKE_DETECTORS.claude)(),
            cursor: (FAKE_DETECTORS.cursor)(),
            codex: (FAKE_DETECTORS.codex)(),
            gemini: (FAKE_DETECTORS.gemini)(),
            opencode: (FAKE_DETECTORS.opencode)(),
        };
        let concurrent = detect_all_with(FAKE_DETECTORS).await;
        assert_eq!(serial.claude, concurrent.claude);
        assert_eq!(serial.cursor, concurrent.cursor);
        assert_eq!(serial.codex, concurrent.codex);
        assert_eq!(serial.gemini, concurrent.gemini);
        assert_eq!(serial.opencode, concurrent.opencode);
    }

    #[tokio::test]
    async fn a_panicking_detection_still_produces_a_status_for_every_provider() {
        let detectors = Detectors {
            codex: || panic!("codex detector blew up"),
            ..FAKE_DETECTORS
        };
        let detected = detect_all_with(detectors).await;
        assert_eq!(detected.codex.id, "codex");
        assert_eq!(detected.codex.binary, "codex");
        assert!(!detected.codex.available);
        assert!(detected.codex.error.is_some());
        assert!(detected.claude.available);
        assert!(detected.opencode.available);
    }

    #[tokio::test]
    async fn the_gate_opens_after_a_panicking_detection() {
        let (gate, opener) = detection_gate();
        let detectors = Detectors {
            gemini: || panic!("gemini detector blew up"),
            ..FAKE_DETECTORS
        };
        tokio::spawn(async move {
            let _ = detect_all_with(detectors).await;
            opener.open();
        });
        gate.wait().await;
    }

    #[tokio::test]
    async fn detections_run_concurrently_rather_than_one_after_another() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::sync::{Condvar, Mutex as StdMutex};

        static IN_FLIGHT: StdMutex<usize> = StdMutex::new(0);
        static ALL_ARRIVED: Condvar = Condvar::new();
        static PEAK: AtomicUsize = AtomicUsize::new(0);

        fn rendezvous(id: &str) -> ProviderStatus {
            let deadline = Instant::now() + Duration::from_secs(3);
            let mut count = IN_FLIGHT.lock().unwrap();
            *count += 1;
            PEAK.fetch_max(*count, Ordering::SeqCst);
            ALL_ARRIVED.notify_all();
            while *count < 5 {
                let now = Instant::now();
                if now >= deadline {
                    break;
                }
                let (next, _) = ALL_ARRIVED.wait_timeout(count, deadline - now).unwrap();
                count = next;
                PEAK.fetch_max(*count, Ordering::SeqCst);
            }
            *count -= 1;
            fake(id)
        }

        let detectors = Detectors {
            claude: || rendezvous("anthropic"),
            cursor: || rendezvous("cursor"),
            codex: || rendezvous("codex"),
            gemini: || rendezvous("gemini"),
            opencode: || rendezvous("opencode"),
        };
        let _ = detect_all_with(detectors).await;
        assert_eq!(
            PEAK.load(Ordering::SeqCst),
            5,
            "all five detections must be in flight at the same time"
        );
    }

    #[test]
    fn aliased_rewrites_only_the_id() {
        let base = ProviderStatus {
            id: "opencode".to_string(),
            binary: "opencode".to_string(),
            available: true,
            version: Some("1.2.3".to_string()),
            error: None,
        };
        let router = aliased(base.clone(), "openrouter");
        assert_eq!(router.id, "openrouter");
        assert_eq!(router.binary, "opencode");
        assert!(router.available);
        assert_eq!(router.version.as_deref(), Some("1.2.3"));
        let moonshot = aliased(base, "moonshot");
        assert_eq!(moonshot.id, "moonshot");
        assert_eq!(moonshot.binary, "opencode");
    }

    #[test]
    fn initial_status_is_unavailable_without_an_error() {
        let s = initial_status("anthropic", "claude");
        assert_eq!(s.id, "anthropic");
        assert_eq!(s.binary, "claude");
        assert!(!s.available);
        assert_eq!(s.version, None);
        assert_eq!(s.error, None);
    }

    fn detect_all_serial() -> DetectedProviders {
        DetectedProviders {
            claude: detect_claude(),
            cursor: detect_cursor(),
            codex: detect_codex(),
            gemini: detect_gemini(),
            opencode: detect_opencode(),
        }
    }

    fn print_detected(label: &str, detected: &DetectedProviders, elapsed: Duration) {
        println!("{label} total {:?}", elapsed);
        for status in [
            &detected.claude,
            &detected.cursor,
            &detected.codex,
            &detected.gemini,
            &detected.opencode,
        ] {
            println!(
                "  {:<10} available={} version={:?} error={:?}",
                status.id, status.available, status.version, status.error
            );
        }
    }

    #[test]
    #[ignore = "timing harness, run one mode per process: cargo test --lib bench_serial_detection -- --ignored --nocapture"]
    fn bench_serial_detection() {
        let started = Instant::now();
        let detected = detect_all_serial();
        print_detected("serial", &detected, started.elapsed());
    }

    #[test]
    #[ignore = "timing harness, run one mode per process: cargo test --lib bench_concurrent_detection -- --ignored --nocapture"]
    fn bench_concurrent_detection() {
        let started = Instant::now();
        let detected = tauri::async_runtime::block_on(detect_all());
        print_detected("concurrent", &detected, started.elapsed());
    }

    #[test]
    #[ignore = "requires the real provider binaries; opt in with --ignored"]
    fn concurrent_and_serial_detection_agree_on_the_real_binaries() {
        let serial = detect_all_serial();
        let concurrent = tauri::async_runtime::block_on(detect_all());
        for (a, b) in [
            (&serial.claude, &concurrent.claude),
            (&serial.cursor, &concurrent.cursor),
            (&serial.codex, &concurrent.codex),
            (&serial.gemini, &concurrent.gemini),
            (&serial.opencode, &concurrent.opencode),
        ] {
            assert_eq!(a.id, b.id);
            assert_eq!(a.binary, b.binary);
            assert_eq!(a.available, b.available);
            assert_eq!(a.version, b.version);
        }
    }

    #[test]
    #[ignore = "requires real codex binary + active login; opt in via GOODBOY_TEST_REAL_CODEX=1"]
    fn codex_real_auth_detection_works() {
        if std::env::var("GOODBOY_TEST_REAL_CODEX")
            .map(|v| v.is_empty())
            .unwrap_or(true)
        {
            return;
        }
        let auth = check_codex_auth();
        assert!(
            !matches!(auth.state, AuthStateKind::Unknown),
            "expected Connected or Disconnected, got Unknown — \
             auth detection regressed (likely back to stdout-only routing)"
        );
    }
}
