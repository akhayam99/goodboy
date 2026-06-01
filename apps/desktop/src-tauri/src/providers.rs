use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::path_env;

// Tight detection budgets: a CLI that doesn't respond to `--version` in 2s is
// already broken from the user's POV, and worst-case sum across 4 providers
// dominates the "refresh providers" UI latency. Auth was previously 5s × N
// candidate subcommands × N providers, easily 20s+ wall time on cold runs.
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

pub struct GeminiState(pub Mutex<ProviderStatus>);

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
    detect_binary("gemini", "gemini")
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
        if self.stdout.trim().is_empty() { &self.stderr } else { &self.stdout }
    }
}

fn run_auth_command(args: &[&str]) -> Result<AuthCommandOutput, String> {
    let (binary, rest) = args.split_first().ok_or_else(|| "empty command".to_string())?;
    let mut child = path_env::command(binary)
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
    for cmd in candidates {
        if let Ok(out) = run_auth_command(cmd) {
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

fn extract_gemini_identity_from_creds() -> Option<String> {
    // gemini-cli stores OAuth credentials at `~/.gemini/oauth_creds.json` after
    // an interactive login; the `email` field carries the user's Google identity.
    // Fallback paths covered: legacy `~/.config/gemini/auth.json`.
    let home = dirs::home_dir()?;
    for rel in ["./.gemini/oauth_creds.json", "./.config/gemini/auth.json"] {
        let path = home.join(rel);
        let Ok(content) = std::fs::read_to_string(&path) else {
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

fn check_gemini_auth() -> AuthState {
    // gemini-cli (v0.x) has no `auth status`-like subcommand. Past attempts to
    // probe `gemini auth status`/`whoami` either hung interactively (no TTY)
    // or printed help, costing 3 × AUTH_TIMEOUT per refresh. The credentials
    // file is the actual ground truth — gemini writes it on every successful
    // login and removes it on logout — so we read it directly. Fast, accurate,
    // no subprocess.
    if let Some(identity) = extract_gemini_identity_from_creds() {
        return AuthState {
            state: AuthStateKind::Connected,
            identity: Some(identity),
        };
    }
    AuthState {
        state: AuthStateKind::Disconnected,
        identity: None,
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
pub fn get_gemini_status(state: State<'_, GeminiState>) -> ProviderStatus {
    state.0.lock().map(|s| s.clone()).unwrap_or_else(|_| ProviderStatus {
        id: "gemini".to_string(),
        binary: "gemini".to_string(),
        available: false,
        version: None,
        error: Some("status mutex poisoned".to_string()),
    })
}

#[tauri::command]
pub fn refresh_gemini_status(state: State<'_, GeminiState>) -> ProviderStatus {
    let next = detect_gemini();
    if let Ok(mut current) = state.0.lock() {
        *current = next.clone();
    }
    next
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
