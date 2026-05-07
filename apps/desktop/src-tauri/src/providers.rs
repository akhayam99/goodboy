use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::State;

const DETECT_TIMEOUT: Duration = Duration::from_secs(2);
const AUTH_TIMEOUT: Duration = Duration::from_secs(2);
const POLL_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Debug, Clone, Serialize)]
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

fn detect_binary(id: &str, binary: &str) -> ProviderStatus {
    let mut child = match Command::new(binary)
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

fn run_auth_command(args: &[&str]) -> Result<String, String> {
    let (binary, rest) = args.split_first().ok_or_else(|| "empty command".to_string())?;
    let mut child = Command::new(binary)
        .args(rest)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let deadline = Instant::now() + AUTH_TIMEOUT;
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
                    return Ok(stdout);
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

/// Extract a JSON string value for `key` from raw JSON text (no external deps).
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

/// Extract first email-like token from plain text output.
fn extract_email(text: &str) -> Option<String> {
    for word in text.split_whitespace() {
        let w = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '@' && c != '.');
        if w.contains('@') && w.contains('.') {
            return Some(w.to_string());
        }
    }
    None
}

fn check_claude_auth() -> AuthState {
    // `claude auth status` outputs JSON: {"loggedIn": bool, "authMethod": "...", ...}
    match run_auth_command(&["claude", "auth", "status"]) {
        Ok(output) => {
            let logged_in =
                output.contains("\"loggedIn\":true") || output.contains("\"loggedIn\": true");
            if !logged_in {
                return AuthState {
                    state: AuthStateKind::Disconnected,
                    identity: None,
                };
            }
            let identity = extract_json_string(&output, "email")
                .or_else(|| extract_json_string(&output, "username"))
                .or_else(|| extract_json_string(&output, "accountName"));
            AuthState {
                state: AuthStateKind::Connected,
                identity,
            }
        }
        Err(_) => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

fn check_cursor_auth() -> AuthState {
    // `cursor-agent status` outputs plain text; "Not logged in" when unauthenticated
    match run_auth_command(&["cursor-agent", "status"]) {
        Ok(output) => {
            let lower = output.to_lowercase();
            if lower.contains("not logged in") || lower.contains("not authenticated") {
                return AuthState {
                    state: AuthStateKind::Disconnected,
                    identity: None,
                };
            }
            let identity = extract_email(&output)
                .or_else(|| extract_json_string(&output, "email"))
                .or_else(|| extract_json_string(&output, "username"));
            AuthState {
                state: AuthStateKind::Connected,
                identity,
            }
        }
        Err(_) => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

fn check_codex_auth() -> AuthState {
    match run_auth_command(&["codex", "auth", "status"]) {
        Ok(output) => {
            let lower = output.to_lowercase();
            if lower.contains("not logged") || lower.contains("unauthenticated") {
                return AuthState {
                    state: AuthStateKind::Disconnected,
                    identity: None,
                };
            }
            let identity = extract_email(&output)
                .or_else(|| extract_json_string(&output, "email"))
                .or_else(|| extract_json_string(&output, "username"));
            AuthState {
                state: AuthStateKind::Connected,
                identity,
            }
        }
        Err(_) => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

#[tauri::command]
pub fn get_provider_status(state: State<'_, ProviderState>) -> ProviderStatus {
    state.0.lock().map(|s| s.clone()).unwrap_or_else(|_| ProviderStatus {
        id: "anthropic".to_string(),
        binary: "claude".to_string(),
        available: false,
        version: None,
        error: Some("status mutex poisoned".to_string()),
    })
}

#[tauri::command]
pub fn refresh_provider_status(state: State<'_, ProviderState>) -> ProviderStatus {
    let next = detect_claude();
    if let Ok(mut current) = state.0.lock() {
        *current = next.clone();
    }
    next
}

#[tauri::command]
pub fn get_cursor_status(state: State<'_, CursorState>) -> ProviderStatus {
    state.0.lock().map(|s| s.clone()).unwrap_or_else(|_| ProviderStatus {
        id: "cursor".to_string(),
        binary: "cursor-agent".to_string(),
        available: false,
        version: None,
        error: Some("status mutex poisoned".to_string()),
    })
}

#[tauri::command]
pub fn refresh_cursor_status(state: State<'_, CursorState>) -> ProviderStatus {
    let next = detect_cursor();
    if let Ok(mut current) = state.0.lock() {
        *current = next.clone();
    }
    next
}

#[tauri::command]
pub fn get_codex_status(state: State<'_, CodexState>) -> ProviderStatus {
    state.0.lock().map(|s| s.clone()).unwrap_or_else(|_| ProviderStatus {
        id: "codex".to_string(),
        binary: "codex".to_string(),
        available: false,
        version: None,
        error: Some("status mutex poisoned".to_string()),
    })
}

#[tauri::command]
pub fn refresh_codex_status(state: State<'_, CodexState>) -> ProviderStatus {
    let next = detect_codex();
    if let Ok(mut current) = state.0.lock() {
        *current = next.clone();
    }
    next
}

#[tauri::command]
pub fn check_provider_auth(provider_id: String) -> AuthState {
    match provider_id.as_str() {
        "anthropic" => check_claude_auth(),
        "cursor" => check_cursor_auth(),
        "codex" => check_codex_auth(),
        _ => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}
