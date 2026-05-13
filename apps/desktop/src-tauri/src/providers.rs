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

pub struct OpenCodeState(pub Mutex<ProviderStatus>);

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

pub fn detect_opencode() -> ProviderStatus {
    detect_binary("opencode", "opencode")
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
    // codex CLI subcommand layout has shifted across versions; try the variants
    // we've seen in the wild before giving up. order matters: most recent first.
    let candidates: &[&[&str]] = &[
        // codex CLI ≥ 0.13 (current). subcommand: `codex login status` →
        // stdout "Logged in using ChatGPT" or "Not logged in".
        &["codex", "login", "status"],
        // legacy / fallback shapes from older versions, kept in case the user
        // still has an older binary on PATH.
        &["codex", "auth", "status"],
        &["codex", "auth", "whoami"],
        &["codex", "whoami"],
        &["codex", "status"],
    ];
    let mut last_output: Option<String> = None;
    for cmd in candidates {
        match run_auth_command(cmd) {
            Ok(output) => {
                last_output = Some(output);
                break;
            }
            Err(err) => {
                last_output = Some(err);
                continue;
            }
        }
    }
    let Some(output) = last_output else {
        return AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        };
    };
    let lower = output.to_lowercase();
    if lower.contains("not logged")
        || lower.contains("unauthenticated")
        || lower.contains("not signed in")
        || lower.contains("no credentials")
    {
        return AuthState {
            state: AuthStateKind::Disconnected,
            identity: None,
        };
    }
    if lower.contains("logged in")
        || lower.contains("signed in")
        || lower.contains("authenticated")
        || extract_email(&output).is_some()
    {
        let identity = extract_email(&output)
            .or_else(|| extract_json_string(&output, "email"))
            .or_else(|| extract_json_string(&output, "username"));
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
pub fn get_opencode_status(state: State<'_, OpenCodeState>) -> ProviderStatus {
    state.0.lock().map(|s| s.clone()).unwrap_or_else(|_| ProviderStatus {
        id: "opencode".to_string(),
        binary: "opencode".to_string(),
        available: false,
        version: None,
        error: Some("status mutex poisoned".to_string()),
    })
}

#[tauri::command]
pub fn refresh_opencode_status(state: State<'_, OpenCodeState>) -> ProviderStatus {
    let next = detect_opencode();
    if let Ok(mut current) = state.0.lock() {
        *current = next.clone();
    }
    next
}

fn provider_login_command(provider_id: &str) -> Option<String> {
    match provider_id {
        "anthropic" => Some("claude /login".to_string()),
        "cursor" => Some("cursor login".to_string()),
        "codex" => Some("codex login".to_string()),
        "opencode" => Some("opencode auth login".to_string()),
        _ => None,
    }
}

fn provider_logout_command(provider_id: &str) -> Option<String> {
    match provider_id {
        "anthropic" => Some("claude /logout".to_string()),
        "cursor" => Some("cursor logout".to_string()),
        "codex" => Some("codex logout".to_string()),
        "opencode" => Some("opencode auth logout".to_string()),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
fn spawn_in_terminal(command: &str) -> Result<(), String> {
    // osascript ensures the terminal window opens and the command runs even if Terminal is already open
    let script = format!(
        "tell application \"Terminal\" to do script \"{}\"",
        command.replace('\\', "\\\\").replace('"', "\\\"")
    );
    Command::new("osascript")
        .args(["-e", &script])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn spawn_in_terminal(command: &str) -> Result<(), String> {
    let terminals: &[(&str, &[&str])] = &[
        ("gnome-terminal", &["--", "bash", "-c"]),
        ("konsole", &["-e", "bash", "-c"]),
        ("xterm", &["-e", "bash", "-c"]),
    ];
    for (term, base_args) in terminals {
        let mut args: Vec<&str> = base_args.to_vec();
        let cmd_with_pause = format!("{}; read -p 'press enter to close'", command);
        args.push(&cmd_with_pause);
        if Command::new(term).args(&args).spawn().is_ok() {
            return Ok(());
        }
    }
    Err("no supported terminal emulator found (tried gnome-terminal, konsole, xterm)".to_string())
}

#[cfg(target_os = "windows")]
fn spawn_in_terminal(command: &str) -> Result<(), String> {
    Command::new("cmd")
        .args(["/c", "start", "cmd", "/k", command])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn spawn_in_terminal(_command: &str) -> Result<(), String> {
    Err("unsupported platform".to_string())
}

#[tauri::command]
pub fn provider_action(provider_id: String, action: String) -> Result<(), String> {
    let command = match action.as_str() {
        "login" => provider_login_command(&provider_id),
        "logout" => provider_logout_command(&provider_id),
        _ => return Err(format!("unknown action: {}", action)),
    }
    .ok_or_else(|| format!("unknown provider: {}", provider_id))?;

    spawn_in_terminal(&command)
}

fn check_opencode_auth() -> AuthState {
    // `opencode auth list` prints credentials + env-based provider auth in two
    // boxed sections. We're connected when at least one credential OR env var
    // is wired; disconnected when both rows show "0".
    match run_auth_command(&["opencode", "auth", "list"]) {
        Ok(output) => {
            // Strip ANSI escapes for robust string matching.
            let cleaned = output.replace('\u{1b}', "");
            let has_zero_creds = cleaned.contains("0 credentials");
            let has_zero_env = cleaned.contains("0 environment variables");
            if has_zero_creds && has_zero_env {
                return AuthState {
                    state: AuthStateKind::Disconnected,
                    identity: None,
                };
            }
            AuthState {
                state: AuthStateKind::Connected,
                identity: None,
            }
        }
        Err(_) => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}

#[tauri::command]
pub fn check_provider_auth(provider_id: String) -> AuthState {
    match provider_id.as_str() {
        "anthropic" => check_claude_auth(),
        "cursor" => check_cursor_auth(),
        "codex" => check_codex_auth(),
        "opencode" => check_opencode_auth(),
        _ => AuthState {
            state: AuthStateKind::Unknown,
            identity: None,
        },
    }
}
