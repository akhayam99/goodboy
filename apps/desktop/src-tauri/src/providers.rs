use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::path_env;
use crate::proc::probe::{self, Budget, ProbeOutput};

pub(crate) mod cli_args;
pub mod test_connection;

#[derive(Debug, Error)]
pub enum ProviderStatusError {
    #[error("provider detection did not finish: {0}")]
    JoinFailed(String),
}

impl ProviderStatusError {
    fn kind(&self) -> &'static str {
        match self {
            ProviderStatusError::JoinFailed(_) => "join_failed",
        }
    }
}

crate::util::impl_error_serialize!(ProviderStatusError);

const DETECT_TIMEOUT: Duration = Duration::from_secs(5);
const AUTH_TIMEOUT: Duration = Duration::from_secs(10);
const CODEX_AUTH_TIMEOUT: Duration = Duration::from_secs(15);
const RETRY_DELAY: Duration = Duration::from_secs(3);

const DETECT_BUDGET: Budget = Budget {
    timeout: DETECT_TIMEOUT,
    retry_delay: RETRY_DELAY,
};
const AUTH_BUDGET: Budget = Budget {
    timeout: AUTH_TIMEOUT,
    retry_delay: RETRY_DELAY,
};
const CODEX_AUTH_BUDGET: Budget = Budget {
    timeout: CODEX_AUTH_TIMEOUT,
    retry_delay: RETRY_DELAY,
};

const REASON_LIMIT: usize = 160;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProbeErrorKind {
    NotFound,
    Timeout,
    Exit,
}

impl ProbeErrorKind {
    fn label(self) -> &'static str {
        match self {
            ProbeErrorKind::NotFound => "not_found",
            ProbeErrorKind::Timeout => "timeout",
            ProbeErrorKind::Exit => "exit",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ProviderStatus {
    pub id: String,
    pub binary: String,
    pub available: bool,
    pub version: Option<String>,
    pub error: Option<String>,
    pub path: Option<String>,
    #[serde(rename = "errorKind")]
    pub error_kind: Option<ProbeErrorKind>,
}

impl ProviderStatus {
    fn found(id: &str, binary: &str, version: String) -> Self {
        Self {
            id: id.to_string(),
            binary: binary.to_string(),
            available: true,
            version: Some(version),
            error: None,
            path: None,
            error_kind: None,
        }
    }

    fn failed(id: &str, binary: &str, kind: ProbeErrorKind, error: String) -> Self {
        Self {
            id: id.to_string(),
            binary: binary.to_string(),
            available: false,
            version: None,
            error: Some(error),
            path: None,
            error_kind: Some(kind),
        }
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
    pub plan: Option<String>,
    pub verified: bool,
    pub reason: Option<String>,
}

impl AuthState {
    fn connected(identity: Option<String>, plan: Option<String>) -> Self {
        Self {
            state: AuthStateKind::Connected,
            identity,
            plan,
            verified: true,
            reason: None,
        }
    }

    fn connected_unverified(reason: String) -> Self {
        Self {
            state: AuthStateKind::Connected,
            identity: None,
            plan: None,
            verified: false,
            reason: Some(reason),
        }
    }

    fn disconnected() -> Self {
        Self {
            state: AuthStateKind::Disconnected,
            identity: None,
            plan: None,
            verified: true,
            reason: None,
        }
    }

    fn unknown(reason: impl Into<String>) -> Self {
        Self {
            state: AuthStateKind::Unknown,
            identity: None,
            plan: None,
            verified: false,
            reason: Some(reason.into()),
        }
    }
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
    detect_binary_within(id, binary, DETECT_BUDGET)
}

fn detect_binary_within(id: &str, binary: &str, budget: Budget) -> ProviderStatus {
    ProviderStatus {
        path: path_env::which(binary),
        ..probe_binary(id, binary, budget)
    }
}

fn log_probe_failure(provider: &str, kind: ProbeErrorKind, millis: u128) {
    log::info!("[probe] {provider} {} {millis}ms", kind.label());
}

fn spawn_error_kind(err: &std::io::Error) -> ProbeErrorKind {
    if err.kind() == std::io::ErrorKind::NotFound {
        return ProbeErrorKind::NotFound;
    }
    ProbeErrorKind::Exit
}

fn probe_binary(id: &str, binary: &str, budget: Budget) -> ProviderStatus {
    let started = Instant::now();
    let result = probe::run_retrying(
        || {
            let mut command = path_env::command(binary);
            command.arg("--version");
            command
        },
        budget,
    );
    let out = match result {
        Ok(out) => out,
        Err(err) => {
            let kind = spawn_error_kind(&err);
            log_probe_failure(id, kind, started.elapsed().as_millis());
            return ProviderStatus::failed(id, binary, kind, err.to_string());
        }
    };
    if out.timed_out {
        log_probe_failure(id, ProbeErrorKind::Timeout, out.elapsed.as_millis());
        return ProviderStatus::failed(
            id,
            binary,
            ProbeErrorKind::Timeout,
            "detection timed out".to_string(),
        );
    }
    if out.code != Some(0) {
        log_probe_failure(id, ProbeErrorKind::Exit, out.elapsed.as_millis());
        return ProviderStatus::failed(
            id,
            binary,
            ProbeErrorKind::Exit,
            format!("exited with code {}", out.code.unwrap_or(-1)),
        );
    }
    ProviderStatus::found(id, binary, out.stdout)
}

fn spawn_failure_reason(err: &std::io::Error) -> String {
    if err.kind() == std::io::ErrorKind::NotFound {
        return "the CLI is not installed".to_string();
    }
    err.to_string()
}

fn output_reason(out: &ProbeOutput) -> String {
    let line = out
        .primary_text()
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty());
    if let Some(line) = line {
        return line.chars().take(REASON_LIMIT).collect();
    }
    match out.code {
        Some(0) => "the CLI printed nothing".to_string(),
        Some(code) => format!("the CLI exited with code {code}"),
        None => "the CLI ended without an exit code".to_string(),
    }
}

fn unrecognized(provider: &str, out: &ProbeOutput) -> AuthState {
    if out.code != Some(0) {
        log_probe_failure(provider, ProbeErrorKind::Exit, out.elapsed.as_millis());
    }
    AuthState::unknown(output_reason(out))
}

fn run_auth(provider: &str, args: &[&str], budget: Budget) -> Result<ProbeOutput, AuthState> {
    let Some((binary, rest)) = args.split_first() else {
        return Err(AuthState::unknown("empty command"));
    };
    let started = Instant::now();
    let result = probe::run_retrying(
        || {
            let mut command = path_env::command(binary);
            command.args(rest);
            command
        },
        budget,
    );
    let out = match result {
        Ok(out) => out,
        Err(err) => {
            let kind = spawn_error_kind(&err);
            log_probe_failure(provider, kind, started.elapsed().as_millis());
            return Err(AuthState::unknown(spawn_failure_reason(&err)));
        }
    };
    if out.timed_out {
        log_probe_failure(provider, ProbeErrorKind::Timeout, out.elapsed.as_millis());
        return Err(AuthState::unknown("the CLI did not answer in time"));
    }
    Ok(out)
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
    check_claude_auth_with("claude", AUTH_BUDGET)
}

fn check_claude_auth_with(binary: &str, budget: Budget) -> AuthState {
    match run_auth("anthropic", &[binary, "auth", "status"], budget) {
        Ok(out) => parse_claude_auth_output(&out),
        Err(state) => state,
    }
}

fn parse_claude_auth_output(out: &ProbeOutput) -> AuthState {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(out.primary_text()) else {
        return unrecognized("anthropic", out);
    };
    match value.get("loggedIn").and_then(|v| v.as_bool()) {
        Some(true) => {
            let identity = ["email", "username", "accountName"]
                .iter()
                .find_map(|k| value.get(k).and_then(|v| v.as_str()).map(|s| s.to_string()));
            let plan = value
                .get("subscriptionType")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());
            AuthState::connected(identity, plan)
        }
        Some(false) => AuthState::disconnected(),
        None => unrecognized("anthropic", out),
    }
}

fn check_cursor_auth() -> AuthState {
    check_cursor_auth_with("cursor-agent", AUTH_BUDGET)
}

fn check_cursor_auth_with(binary: &str, budget: Budget) -> AuthState {
    match run_auth("cursor", &[binary, "status", "--format", "json"], budget) {
        Ok(out) => {
            if let Some(state) = parse_cursor_status_json(&out) {
                return state;
            }
        }
        Err(state) => return state,
    }
    match run_auth("cursor", &[binary, "status"], budget) {
        Ok(out) => parse_cursor_auth_output(&out),
        Err(state) => state,
    }
}

fn json_text(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn parse_cursor_status_json(out: &ProbeOutput) -> Option<AuthState> {
    let stripped = strip_ansi(out.primary_text());
    let start = stripped.find('{')?;
    let end = stripped.rfind('}')?;
    if end < start {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(&stripped[start..=end]).ok()?;
    let is_authenticated = value.get("isAuthenticated")?.as_bool()?;
    if !is_authenticated {
        return Some(AuthState::disconnected());
    }
    if value.get("hasAccessToken").and_then(|v| v.as_bool()) == Some(false) {
        return Some(AuthState::unknown("Cursor holds no access token"));
    }
    let message = json_text(&value, "message");
    let identity = json_text(&value, "email")
        .or_else(|| message.as_deref().and_then(extract_email))
        .or_else(|| {
            json_text(&value, "about")
                .as_deref()
                .and_then(extract_email)
        });
    if let Some(identity) = identity {
        return Some(AuthState::connected(Some(identity), None));
    }
    Some(AuthState::connected_unverified(message.unwrap_or_else(
        || "Cursor did not confirm the account with its server".to_string(),
    )))
}

fn parse_cursor_auth_output(out: &ProbeOutput) -> AuthState {
    let stripped = strip_ansi(out.primary_text());
    let text = stripped.trim();
    if text.is_empty() {
        return unrecognized("cursor", out);
    }
    let lower = text.to_lowercase();
    if lower.contains("not logged in")
        || lower.contains("not authenticated")
        || lower.contains("not signed in")
        || lower.contains("logged out")
    {
        return AuthState::disconnected();
    }
    let identity = extract_email(text)
        .or_else(|| extract_json_string(text, "email"))
        .or_else(|| extract_json_string(text, "username"));
    if let Some(identity) = identity {
        return AuthState::connected(Some(identity), None);
    }
    let is_positive = lower.contains("logged in")
        || lower.contains("signed in")
        || lower.contains("authenticated as");
    if !is_positive {
        return unrecognized("cursor", out);
    }
    let first_line = text.lines().next().unwrap_or(text);
    AuthState::connected_unverified(first_line.chars().take(REASON_LIMIT).collect())
}

fn check_codex_auth() -> AuthState {
    check_codex_auth_with("codex", CODEX_AUTH_BUDGET)
}

fn check_codex_auth_with(binary: &str, budget: Budget) -> AuthState {
    let candidates: [&[&str]; 2] = [&[binary, "login", "status"], &[binary, "status"]];
    let mut last = AuthState::unknown("the CLI gave no status");
    for args in candidates {
        let out = match run_auth("codex", args, budget) {
            Ok(out) => out,
            Err(state) => return state,
        };
        let state = parse_codex_auth_output(&out);
        if state.state != AuthStateKind::Unknown {
            return state;
        }
        last = state;
    }
    last
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
    if let Some(identity) = extract_gemini_identity_from_creds() {
        return AuthState::connected(Some(identity), None);
    }
    if gemini_creds_present() {
        return AuthState::connected(None, None);
    }
    AuthState::disconnected()
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

fn opencode_credentials(budget: Budget) -> Result<Vec<String>, AuthState> {
    let out = run_auth("opencode", &["opencode", "auth", "list"], budget)?;
    if out.code != Some(0) {
        return Err(unrecognized("opencode", &out));
    }
    Ok(parse_opencode_credentials(out.primary_text()))
}

fn check_opencode_auth() -> AuthState {
    match opencode_credentials(AUTH_BUDGET) {
        Err(state) => state,
        Ok(names) if names.is_empty() => AuthState::disconnected(),
        Ok(names) => AuthState::connected(Some(names.join(", ")), None),
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

fn check_credential_auth(find: fn(&[String]) -> Option<&String>) -> AuthState {
    match opencode_credentials(AUTH_BUDGET) {
        Err(state) => state,
        Ok(names) => match find(&names) {
            Some(name) => AuthState::connected(Some(name.clone()), None),
            None => AuthState::disconnected(),
        },
    }
}

fn check_openrouter_auth() -> AuthState {
    check_credential_auth(openrouter_credential)
}

fn check_moonshot_auth() -> AuthState {
    check_credential_auth(moonshot_credential)
}

fn parse_codex_auth_output(out: &ProbeOutput) -> AuthState {
    let stripped: String = strip_ansi(out.primary_text());
    let first_line = stripped
        .lines()
        .map(|l| l.trim())
        .find(|l| !l.is_empty())
        .unwrap_or("");
    let lower = first_line.to_lowercase();

    if lower.starts_with("not logged")
        || lower.starts_with("not signed")
        || lower.contains("not logged in")
        || lower.contains("not signed in")
        || lower.contains("unauthenticated")
        || lower.contains("no credentials")
    {
        return AuthState::disconnected();
    }
    if lower.starts_with("logged in")
        || lower.starts_with("signed in")
        || lower.starts_with("you are logged in")
        || lower.contains("authenticated as")
        || extract_email(first_line).is_some()
    {
        let identity = extract_email(first_line)
            .or_else(|| extract_json_string(&stripped, "email"))
            .or_else(|| extract_json_string(&stripped, "username"))
            .or_else(extract_codex_identity_from_auth_json);
        return AuthState::connected(identity, None);
    }

    unrecognized("codex", out)
}

#[tauri::command]
pub async fn refresh_provider_status() -> Result<ProviderStatus, ProviderStatusError> {
    refresh_status(detect_claude).await
}

#[tauri::command]
pub async fn refresh_cursor_status() -> Result<ProviderStatus, ProviderStatusError> {
    refresh_status(detect_cursor).await
}

#[tauri::command]
pub async fn refresh_codex_status() -> Result<ProviderStatus, ProviderStatusError> {
    refresh_status(detect_codex).await
}

#[tauri::command]
pub async fn refresh_gemini_status() -> Result<ProviderStatus, ProviderStatusError> {
    refresh_status(detect_gemini).await
}

#[tauri::command]
pub async fn refresh_openrouter_status() -> Result<ProviderStatus, ProviderStatusError> {
    let mut status = refresh_status(detect_opencode).await?;
    status.id = "openrouter".to_string();
    Ok(status)
}

#[tauri::command]
pub async fn refresh_moonshot_status() -> Result<ProviderStatus, ProviderStatusError> {
    let mut status = refresh_status(detect_opencode).await?;
    status.id = "moonshot".to_string();
    Ok(status)
}

#[tauri::command]
pub async fn refresh_opencode_status() -> Result<ProviderStatus, ProviderStatusError> {
    refresh_status(detect_opencode).await
}

async fn refresh_status(
    detect: fn() -> ProviderStatus,
) -> Result<ProviderStatus, ProviderStatusError> {
    tauri::async_runtime::spawn_blocking(detect)
        .await
        .map_err(|err| ProviderStatusError::JoinFailed(err.to_string()))
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
        _ => AuthState::unknown("unknown provider"),
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
        .unwrap_or_else(|_| AuthState::unknown("the check did not finish"))
}

#[cfg(all(test, unix))]
mod fake_cli_tests;

#[cfg(test)]
mod tests {
    use super::*;

    fn out(code: Option<i32>, stdout: &str) -> ProbeOutput {
        ProbeOutput {
            code,
            stdout: stdout.to_string(),
            ..ProbeOutput::default()
        }
    }

    fn err_out(code: Option<i32>, stderr: &str) -> ProbeOutput {
        ProbeOutput {
            code,
            stderr: stderr.to_string(),
            ..ProbeOutput::default()
        }
    }

    #[test]
    fn provider_status_error_serializes_kind_and_message() {
        let value = serde_json::to_value(ProviderStatusError::JoinFailed(
            "task cancelled".to_string(),
        ))
        .expect("serializes");
        assert_eq!(value["kind"], "join_failed");
        assert_eq!(
            value["message"],
            "provider detection did not finish: task cancelled"
        );
    }

    #[test]
    fn claude_parses_logged_in_json() {
        let json = r#"{"loggedIn":true,"authMethod":"claude.ai","email":"a@b.com"}"#;
        let s = parse_claude_auth_output(&out(Some(0), json));
        assert_eq!(s.state, AuthStateKind::Connected);
        assert_eq!(s.identity.as_deref(), Some("a@b.com"));
        assert_eq!(s.plan, None);
    }

    #[test]
    fn claude_reads_the_plan_from_subscription_type() {
        let json = r#"{"loggedIn":true,"authMethod":"claude.ai","email":"a@b.com","subscriptionType":"team"}"#;
        let s = parse_claude_auth_output(&out(Some(0), json));
        assert_eq!(s.plan.as_deref(), Some("team"));
    }

    #[test]
    fn claude_parses_logged_out_json() {
        let s = parse_claude_auth_output(&out(Some(0), r#"{"loggedIn":false}"#));
        assert_eq!(s.state, AuthStateKind::Disconnected);
        assert_eq!(s.identity, None);
    }

    #[test]
    fn claude_returns_unknown_on_non_json() {
        let s = parse_claude_auth_output(&out(Some(0), "garbage not json"));
        assert_eq!(s.state, AuthStateKind::Unknown);
    }

    #[test]
    fn claude_falls_back_to_username_when_email_missing() {
        let json = r#"{"loggedIn":true,"username":"alice"}"#;
        let s = parse_claude_auth_output(&out(Some(0), json));
        assert_eq!(s.state, AuthStateKind::Connected);
        assert_eq!(s.identity.as_deref(), Some("alice"));
    }

    #[test]
    fn codex_logged_in_with_chatgpt() {
        let s = parse_codex_auth_output(&out(Some(0), "Logged in using ChatGPT\n"));
        assert_eq!(s.state, AuthStateKind::Connected);
    }

    #[test]
    fn codex_logged_in_with_api_key() {
        let s = parse_codex_auth_output(&out(Some(0), "Logged in using API key\n"));
        assert_eq!(s.state, AuthStateKind::Connected);
    }

    #[test]
    fn codex_not_logged_in() {
        let s = parse_codex_auth_output(&out(Some(0), "Not logged in\n"));
        assert_eq!(s.state, AuthStateKind::Disconnected);
    }

    #[test]
    fn codex_handles_ansi_escapes() {
        let s =
            parse_codex_auth_output(&out(Some(0), "\u{1b}[1mLogged in using ChatGPT\u{1b}[0m\n"));
        assert_eq!(s.state, AuthStateKind::Connected);
    }

    #[test]
    fn codex_extracts_email_when_present() {
        let s = parse_codex_auth_output(&out(Some(0), "Logged in as alice@example.com\n"));
        assert_eq!(s.state, AuthStateKind::Connected);
        assert_eq!(s.identity.as_deref(), Some("alice@example.com"));
    }

    #[test]
    fn codex_returns_unknown_on_unrecognized() {
        let s = parse_codex_auth_output(&out(Some(0), "whatever new wording\n"));
        assert_eq!(s.state, AuthStateKind::Unknown);
    }

    #[test]
    fn codex_ignores_leading_blank_lines() {
        let s = parse_codex_auth_output(&out(Some(0), "\n\n  \nLogged in using ChatGPT\n"));
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
        let out = ProbeOutput {
            stdout: "Logged in using API key (sk-…)\n".to_string(),
            ..ProbeOutput::default()
        };
        assert_eq!(out.primary_text(), "Logged in using API key (sk-…)\n");
    }

    #[test]
    fn auth_output_falls_back_to_stderr_when_stdout_empty() {
        let out = ProbeOutput {
            stderr: "Logged in using ChatGPT\n".to_string(),
            ..ProbeOutput::default()
        };
        assert_eq!(out.primary_text(), "Logged in using ChatGPT\n");
        let parsed = parse_codex_auth_output(&out);
        assert_eq!(parsed.state, AuthStateKind::Connected);
    }

    #[test]
    fn auth_output_uses_stdout_when_only_whitespace_on_stderr() {
        let out = ProbeOutput {
            stdout: "Logged in using ChatGPT\n".to_string(),
            stderr: "  \n".to_string(),
            ..ProbeOutput::default()
        };
        assert_eq!(out.primary_text(), "Logged in using ChatGPT\n");
    }

    #[test]
    fn auth_output_returns_empty_when_both_streams_empty() {
        let out = ProbeOutput::default();
        assert!(out.primary_text().trim().is_empty());
    }

    #[test]
    fn cursor_not_logged_in_is_disconnected() {
        let s = parse_cursor_auth_output(&out(Some(0), "Not logged in\n"));
        assert_eq!(s.state, AuthStateKind::Disconnected);
    }

    #[test]
    fn cursor_empty_output_is_unknown_not_connected() {
        // Regression: empty/odd output used to fall through to Connected.
        let s = parse_cursor_auth_output(&out(Some(0), ""));
        assert_eq!(s.state, AuthStateKind::Unknown);
        let s2 = parse_cursor_auth_output(&out(Some(0), "   \n  \n"));
        assert_eq!(s2.state, AuthStateKind::Unknown);
    }

    #[test]
    fn cursor_unrecognized_output_is_unknown() {
        let s = parse_cursor_auth_output(&out(Some(0), "some unexpected banner line\n"));
        assert_eq!(s.state, AuthStateKind::Unknown);
    }

    #[test]
    fn cursor_logged_in_with_email_is_connected() {
        let s = parse_cursor_auth_output(&out(Some(0), "Logged in as alice@example.com\n"));
        assert_eq!(s.state, AuthStateKind::Connected);
        assert_eq!(s.identity.as_deref(), Some("alice@example.com"));
    }

    #[test]
    fn cursor_logged_in_phrase_without_identity_is_connected() {
        let s = parse_cursor_auth_output(&out(Some(0), "Signed in\n"));
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

    #[test]
    fn claude_reads_a_logged_out_json_whatever_the_exit_code() {
        let s = parse_claude_auth_output(&out(Some(1), r#"{"loggedIn":false}"#));
        assert_eq!(s.state, AuthStateKind::Disconnected);
        assert_eq!(s.reason, None);
    }

    #[test]
    fn claude_json_without_a_logged_in_flag_is_unknown() {
        let s = parse_claude_auth_output(&out(Some(0), r#"{"authMethod":"none"}"#));
        assert_eq!(s.state, AuthStateKind::Unknown);
        assert!(s.reason.is_some());
    }

    #[test]
    fn claude_empty_output_is_unknown_with_the_exit_code_as_reason() {
        let s = parse_claude_auth_output(&out(Some(2), ""));
        assert_eq!(s.state, AuthStateKind::Unknown);
        assert_eq!(s.reason.as_deref(), Some("the CLI exited with code 2"));
    }

    #[test]
    fn codex_not_logged_in_with_exit_1_is_disconnected() {
        let s = parse_codex_auth_output(&err_out(Some(1), "Not logged in\n"));
        assert_eq!(s.state, AuthStateKind::Disconnected);
    }

    #[test]
    fn codex_unrecognized_output_keeps_the_first_line_as_reason() {
        let s = parse_codex_auth_output(&out(Some(0), "whatever new wording\nsecond line\n"));
        assert_eq!(s.reason.as_deref(), Some("whatever new wording"));
    }

    #[test]
    fn cursor_json_with_an_email_in_the_message_is_verified() {
        let json = r#"{"isAuthenticated":true,"hasAccessToken":true,"message":"Logged in as avery@harborline.test"}"#;
        let s = parse_cursor_status_json(&out(Some(0), json)).expect("recognised");
        assert_eq!(s.state, AuthStateKind::Connected);
        assert_eq!(s.identity.as_deref(), Some("avery@harborline.test"));
        assert!(s.verified);
    }

    #[test]
    fn cursor_json_reads_the_email_from_about_when_the_message_has_none() {
        let json = r#"{"isAuthenticated":true,"hasAccessToken":true,"message":"Logged in","about":"Signed in as avery@harborline.test (Pro)"}"#;
        let s = parse_cursor_status_json(&out(Some(0), json)).expect("recognised");
        assert_eq!(s.identity.as_deref(), Some("avery@harborline.test"));
        assert!(s.verified);
    }

    #[test]
    fn cursor_json_without_user_details_is_connected_but_unverified() {
        let json = r#"{"isAuthenticated":true,"hasAccessToken":true,"message":"Logged in (unable to fetch user details)"}"#;
        let s = parse_cursor_status_json(&out(Some(0), json)).expect("recognised");
        assert_eq!(s.state, AuthStateKind::Connected);
        assert!(!s.verified);
        assert_eq!(
            s.reason.as_deref(),
            Some("Logged in (unable to fetch user details)")
        );
    }

    #[test]
    fn cursor_json_that_is_not_authenticated_is_disconnected() {
        let json = r#"{"isAuthenticated":false,"hasAccessToken":false,"message":"Not logged in"}"#;
        let s = parse_cursor_status_json(&out(Some(1), json)).expect("recognised");
        assert_eq!(s.state, AuthStateKind::Disconnected);
    }

    #[test]
    fn cursor_json_without_an_access_token_is_unknown() {
        let json = r#"{"isAuthenticated":true,"hasAccessToken":false,"message":"Logged in"}"#;
        let s = parse_cursor_status_json(&out(Some(0), json)).expect("recognised");
        assert_eq!(s.state, AuthStateKind::Unknown);
    }

    #[test]
    fn cursor_json_survives_ansi_noise_around_the_object() {
        let noisy = "\u{1b}[2mcursor-agent\u{1b}[0m\n{\"isAuthenticated\":false}\n";
        let s = parse_cursor_status_json(&out(Some(0), noisy)).expect("recognised");
        assert_eq!(s.state, AuthStateKind::Disconnected);
    }

    #[test]
    fn cursor_json_parser_declines_what_is_not_a_status_object() {
        assert!(parse_cursor_status_json(&out(Some(0), "")).is_none());
        assert!(parse_cursor_status_json(&out(Some(0), "   \n")).is_none());
        assert!(parse_cursor_status_json(&out(Some(0), "Logged in")).is_none());
        assert!(parse_cursor_status_json(&out(Some(0), "{not json}")).is_none());
        assert!(parse_cursor_status_json(&out(Some(0), r#"{"status":"x"}"#)).is_none());
        assert!(parse_cursor_status_json(&out(Some(1), "usage: cursor-agent status")).is_none());
    }

    #[test]
    fn cursor_json_parser_handles_a_huge_payload() {
        let padding = "x".repeat(100_000);
        let json = format!(r#"{{"isAuthenticated":true,"message":"{padding}"}}"#);
        let s = parse_cursor_status_json(&out(Some(0), &json)).expect("recognised");
        assert_eq!(s.state, AuthStateKind::Connected);
        assert!(!s.verified);
    }

    #[test]
    fn cursor_text_status_without_details_is_connected_but_unverified() {
        let s =
            parse_cursor_auth_output(&out(Some(0), "Logged in (unable to fetch user details)\n"));
        assert_eq!(s.state, AuthStateKind::Connected);
        assert!(!s.verified);
        assert_eq!(
            s.reason.as_deref(),
            Some("Logged in (unable to fetch user details)")
        );
    }

    #[test]
    fn cursor_unrecognized_text_keeps_a_reason() {
        let s = parse_cursor_auth_output(&out(Some(1), "some unexpected banner line\n"));
        assert_eq!(s.state, AuthStateKind::Unknown);
        assert_eq!(s.reason.as_deref(), Some("some unexpected banner line"));
    }

    #[test]
    fn probe_error_kind_serializes_in_camel_case() {
        let kinds = [
            (ProbeErrorKind::NotFound, "notFound"),
            (ProbeErrorKind::Timeout, "timeout"),
            (ProbeErrorKind::Exit, "exit"),
        ];
        for (kind, name) in kinds {
            assert_eq!(serde_json::to_value(kind).expect("serializes"), name);
        }
    }

    #[test]
    fn provider_status_serializes_its_error_kind_as_error_kind() {
        let status =
            ProviderStatus::failed("codex", "codex", ProbeErrorKind::NotFound, "gone".into());
        let value = serde_json::to_value(status).expect("serializes");
        assert_eq!(value["errorKind"], "notFound");
        assert_eq!(value["available"], false);
    }

    #[test]
    fn auth_state_serializes_verified_and_reason() {
        let value = serde_json::to_value(AuthState::connected_unverified("local only".into()))
            .expect("serializes");
        assert_eq!(value["state"], "connected");
        assert_eq!(value["verified"], false);
        assert_eq!(value["reason"], "local only");
    }
}
