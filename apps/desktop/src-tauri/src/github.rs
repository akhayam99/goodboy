use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde::Serialize;
use thiserror::Error;

use crate::secrets;

const TOKEN_KEY: &str = "github.pat";

const EMPTY_TOKEN_MESSAGE: &str = "Paste a personal API key first.";
const BAD_CREDENTIALS_MESSAGE: &str =
    "GitHub rejected this personal API key. Check you pasted the whole value, then try again.";
const EXPIRED_MESSAGE: &str =
    "This personal API key has expired or was revoked. Create a new one on GitHub and paste it here.";
const MISSING_SCOPE_MESSAGE: &str = "This personal API key is missing the access Goodboy needs. Recreate it with the repo scope, and authorize it for your org if SSO is on.";
const NETWORK_MESSAGE: &str =
    "Goodboy cannot reach github.com. Check your connection, then try again.";
const CERTIFICATE_MESSAGE: &str = "Goodboy cannot verify the certificate github.com presented. Check your system clock and any proxy or VPN in the way, then try again.";
const RATE_LIMIT_MESSAGE: &str =
    "GitHub is rate limiting this personal API key. Wait a few minutes, then try again.";
const UNVERIFIED_MESSAGE: &str = "Goodboy could not verify this personal API key.";
const TIMEOUT_MESSAGE: &str =
    "The gh CLI stopped responding, so Goodboy gave up waiting. Check your connection, then try again.";

const GH_BIN: &str = "gh";
const GH_TIMEOUT: Duration = Duration::from_secs(60);
const GH_PROBE_TIMEOUT: Duration = Duration::from_secs(10);
const GH_POLL_INTERVAL: Duration = Duration::from_millis(25);

const CERTIFICATE_MARKERS: &[&str] = &["x509", "certificate", "unknown authority"];

const NETWORK_MARKERS: &[&str] = &[
    "dial tcp",
    "no such host",
    "could not resolve host",
    "temporary failure in name resolution",
    "network is unreachable",
    "network is down",
    "connection refused",
    "connection reset",
    "i/o timeout",
    "tls handshake",
    "proxyconnect",
    "error connecting to",
    "check your internet connection",
    "githubstatus.com",
];

const RATE_LIMIT_MARKERS: &[&str] = &[
    "rate limit",
    "abuse detection",
    "http 429",
    "429 too many requests",
];

const EXPIRED_MARKERS: &[&str] = &["expired", "revoked", "has been deleted"];

const MISSING_SCOPE_MARKERS: &[&str] = &[
    "missing required scopes",
    "insufficient scope",
    "resource not accessible",
    "saml enforcement",
    "must grant your",
];

const BAD_CREDENTIALS_MARKERS: &[&str] = &[
    "bad credentials",
    "http 401",
    "401 unauthorized",
    "requires authentication",
    "invalid token",
    "is invalid",
];

#[derive(Debug, PartialEq, Eq)]
enum TokenFailure {
    Certificate,
    Network,
    RateLimited,
    Expired,
    MissingScope,
    BadCredentials,
    Unverified,
}

fn classify_token_failure(stderr: &str) -> TokenFailure {
    let haystack = stderr.to_lowercase();
    let matches = |markers: &[&str]| markers.iter().any(|marker| haystack.contains(marker));
    if matches(CERTIFICATE_MARKERS) {
        return TokenFailure::Certificate;
    }
    if matches(NETWORK_MARKERS) {
        return TokenFailure::Network;
    }
    if matches(RATE_LIMIT_MARKERS) {
        return TokenFailure::RateLimited;
    }
    if matches(EXPIRED_MARKERS) {
        return TokenFailure::Expired;
    }
    if matches(MISSING_SCOPE_MARKERS) {
        return TokenFailure::MissingScope;
    }
    if matches(BAD_CREDENTIALS_MARKERS) {
        return TokenFailure::BadCredentials;
    }
    TokenFailure::Unverified
}

fn token_failure_message(stderr: &str, exit_code: i32) -> String {
    match classify_token_failure(stderr) {
        TokenFailure::Certificate => CERTIFICATE_MESSAGE.to_string(),
        TokenFailure::Network => NETWORK_MESSAGE.to_string(),
        TokenFailure::RateLimited => RATE_LIMIT_MESSAGE.to_string(),
        TokenFailure::Expired => EXPIRED_MESSAGE.to_string(),
        TokenFailure::MissingScope => MISSING_SCOPE_MESSAGE.to_string(),
        TokenFailure::BadCredentials => BAD_CREDENTIALS_MESSAGE.to_string(),
        TokenFailure::Unverified => match stderr.lines().map(str::trim).find(|l| !l.is_empty()) {
            Some(detail) => format!("{UNVERIFIED_MESSAGE} gh said: {detail}"),
            None => format!("{UNVERIFIED_MESSAGE} gh exited with {exit_code}."),
        },
    }
}

#[derive(Debug, Error)]
pub enum GithubError {
    #[error(
        "Goodboy cannot find the gh CLI. Install it from cli.github.com, then restart Goodboy."
    )]
    NotFound,
    #[error("gh command failed: {0}")]
    Spawn(#[from] std::io::Error),
    #[error("secret store error: {0}")]
    Secret(#[from] secrets::SecretError),
    #[error("gh validation failed: {0}")]
    Validation(String),
    #[error("{0}")]
    TokenRejected(String),
    #[error("{}", TIMEOUT_MESSAGE)]
    Timeout,
}

impl Serialize for GithubError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhStatus {
    pub available: bool,
    pub mode: String,
    pub version: Option<String>,
    pub user: Option<String>,
    pub scopes: Vec<String>,
    pub scoped: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhRunResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

fn command_succeeds(cmd: Command, timeout: Duration) -> bool {
    run_with_timeout(cmd, timeout)
        .map(|res| res.exit_code == 0)
        .unwrap_or(false)
}

fn gh_available() -> bool {
    let mut cmd = crate::path_env::command(GH_BIN);
    cmd.arg("--version");
    command_succeeds(cmd, GH_PROBE_TIMEOUT)
}

fn run_binary(
    binary: &str,
    timeout: Duration,
    args: &[&str],
    cwd: Option<&str>,
    token: Option<&str>,
) -> Result<GhRunResult, GithubError> {
    let mut cmd = crate::path_env::command(binary);
    cmd.args(args);
    if let Some(dir) = cwd {
        if !dir.is_empty() {
            cmd.current_dir(dir);
        }
    }
    if let Some(t) = token {
        if !t.is_empty() {
            cmd.env("GH_TOKEN", t);
            cmd.env("GITHUB_TOKEN", t);
        }
    }
    match run_with_timeout(cmd, timeout) {
        Err(GithubError::Spawn(err)) if err.kind() == std::io::ErrorKind::NotFound => {
            Err(GithubError::NotFound)
        }
        outcome => outcome,
    }
}

fn run_gh(
    args: &[&str],
    cwd: Option<&str>,
    token: Option<&str>,
) -> Result<GhRunResult, GithubError> {
    run_binary(GH_BIN, GH_TIMEOUT, args, cwd, token)
}

fn drain<R: Read + Send + 'static>(stream: Option<R>) -> std::thread::JoinHandle<Vec<u8>> {
    std::thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(mut stream) = stream {
            let _ = stream.read_to_end(&mut buffer);
        }
        buffer
    })
}

fn run_with_timeout(mut cmd: Command, timeout: Duration) -> Result<GhRunResult, GithubError> {
    let mut child = cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
    let stdout = drain(child.stdout.take());
    let stderr = drain(child.stderr.take());
    let deadline = Instant::now() + timeout;
    loop {
        if let Some(status) = child.try_wait()? {
            let out = stdout.join().unwrap_or_default();
            let err = stderr.join().unwrap_or_default();
            return Ok(GhRunResult {
                stdout: String::from_utf8_lossy(&out).to_string(),
                stderr: String::from_utf8_lossy(&err).to_string(),
                exit_code: status.code().unwrap_or(-1),
            });
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout.join();
            let _ = stderr.join();
            return Err(GithubError::Timeout);
        }
        std::thread::sleep(GH_POLL_INTERVAL);
    }
}

fn run_git_push(args: &[&str], cwd: &str, token: Option<&str>) -> Result<GhRunResult, GithubError> {
    let mut cmd = crate::path_env::command_with_login_env("git");
    if gh_available() {
        cmd.args([
            "-c",
            "credential.https://github.com.helper=",
            "-c",
            "credential.https://github.com.helper=!gh auth git-credential",
        ]);
    }
    cmd.args(args);
    if !cwd.is_empty() {
        cmd.current_dir(cwd);
    }
    if let Some(t) = token {
        if !t.is_empty() {
            cmd.env("GH_TOKEN", t);
            cmd.env("GITHUB_TOKEN", t);
        }
    }
    let output = cmd.output()?;
    Ok(GhRunResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

fn parse_version(stdout: &str) -> Option<String> {
    stdout
        .lines()
        .find_map(|l| l.strip_prefix("gh version "))
        .and_then(|rest| rest.split_whitespace().next().map(|s| s.to_string()))
}

fn token_key(workspace_id: Option<&str>) -> String {
    match workspace_id {
        Some(id) if !id.is_empty() => format!("{TOKEN_KEY}.{id}"),
        _ => TOKEN_KEY.to_string(),
    }
}

fn read_token_from<F>(
    workspace_id: Option<&str>,
    member_workspace_id: Option<&str>,
    mut reader: F,
) -> Option<String>
where
    F: FnMut(&str) -> Option<String>,
{
    let mut keys = Vec::new();
    for id in [workspace_id, member_workspace_id]
        .into_iter()
        .flatten()
        .filter(|id| !id.is_empty())
    {
        let key = token_key(Some(id));
        if !keys.contains(&key) {
            keys.push(key);
        }
    }
    keys.push(TOKEN_KEY.to_string());
    keys.into_iter().find_map(|key| reader(&key))
}

fn read_token(workspace_id: Option<&str>, member_workspace_id: Option<&str>) -> Option<String> {
    read_token_from(workspace_id, member_workspace_id, |key| {
        secrets::read(key).ok().flatten()
    })
}

pub(crate) fn token_for_workspace(workspace_id: Option<&str>) -> Option<String> {
    read_token(workspace_id, None).filter(|t| !t.is_empty())
}

fn absent_status() -> GhStatus {
    GhStatus {
        available: false,
        mode: "absent".to_string(),
        version: None,
        user: None,
        scopes: Vec::new(),
        scoped: false,
    }
}

fn status_blocking(workspace_id: Option<String>, member_workspace_id: Option<String>) -> GhStatus {
    let ws = workspace_id.as_deref();
    let version = match run_gh(&["--version"], None, None) {
        Ok(res) => parse_version(&res.stdout),
        Err(GithubError::NotFound) => return absent_status(),
        Err(_) => None,
    };

    let pat = read_token(ws, member_workspace_id.as_deref());
    let token_ref = pat.as_deref();
    let scoped = ws
        .filter(|s| !s.is_empty())
        .map(|id| matches!(secrets::read(&token_key(Some(id))), Ok(Some(_))))
        .unwrap_or(false);

    let user = run_gh(&["api", "user", "-q", ".login"], None, token_ref)
        .ok()
        .filter(|r| r.exit_code == 0)
        .map(|r| r.stdout.trim().to_string())
        .filter(|s| !s.is_empty());

    let mode = match (&user, pat.is_some()) {
        (Some(_), true) => "pat",
        (Some(_), false) => "gh-cli",
        _ => "absent",
    };

    GhStatus {
        available: true,
        mode: mode.to_string(),
        version,
        user,
        scopes: Vec::new(),
        scoped,
    }
}

#[tauri::command]
pub async fn gh_status(
    workspace_id: Option<String>,
    member_workspace_id: Option<String>,
) -> GhStatus {
    tauri::async_runtime::spawn_blocking(move || status_blocking(workspace_id, member_workspace_id))
        .await
        .unwrap_or_else(|_| absent_status())
}

fn validate_token_with<F>(token: &str, run: F) -> Result<(), GithubError>
where
    F: FnOnce(&str) -> Result<GhRunResult, GithubError>,
{
    if token.trim().is_empty() {
        return Err(GithubError::TokenRejected(EMPTY_TOKEN_MESSAGE.to_string()));
    }
    let res = run(token)?;
    if res.exit_code != 0 {
        return Err(GithubError::TokenRejected(token_failure_message(
            &res.stderr,
            res.exit_code,
        )));
    }
    Ok(())
}

#[tauri::command]
pub async fn gh_set_token(
    token: String,
    workspace_id: Option<String>,
) -> Result<GhStatus, GithubError> {
    tauri::async_runtime::spawn_blocking(move || {
        validate_token_with(&token, |candidate| {
            run_gh(&["api", "user", "-q", ".login"], None, Some(candidate))
        })?;
        secrets::set(&token_key(workspace_id.as_deref()), &token)?;
        Ok(status_blocking(workspace_id, None))
    })
    .await
    .map_err(|e| GithubError::Spawn(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub fn gh_clear_token(workspace_id: Option<String>) -> Result<(), GithubError> {
    secrets::clear(&token_key(workspace_id.as_deref()))?;
    Ok(())
}

#[tauri::command]
pub async fn gh_run(
    args: Vec<String>,
    cwd: Option<String>,
    workspace_id: Option<String>,
    member_workspace_id: Option<String>,
) -> Result<GhRunResult, GithubError> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = read_token(workspace_id.as_deref(), member_workspace_id.as_deref());
        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_gh(&arg_refs, cwd.as_deref(), token.as_deref())
    })
    .await
    .map_err(|e| GithubError::Spawn(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn git_push(
    cwd: String,
    branch: Option<String>,
    workspace_id: Option<String>,
    member_workspace_id: Option<String>,
) -> Result<GhRunResult, GithubError> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = read_token(workspace_id.as_deref(), member_workspace_id.as_deref());
        let mut args: Vec<&str> = vec!["push"];
        if let Some(b) = branch.as_deref().filter(|b| !b.is_empty()) {
            args.push("origin");
            args.push(b);
        }
        run_git_push(&args, &cwd, token.as_deref())
    })
    .await
    .map_err(|e| GithubError::Spawn(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn gh_pr_diff(
    repo: String,
    pr: u32,
    cwd: Option<String>,
    workspace_id: Option<String>,
    member_workspace_id: Option<String>,
) -> Result<String, GithubError> {
    tauri::async_runtime::spawn_blocking(move || {
        let token = read_token(workspace_id.as_deref(), member_workspace_id.as_deref());
        let pr_str = pr.to_string();
        let res = run_gh(
            &["pr", "diff", &pr_str, "--repo", &repo],
            cwd.as_deref(),
            token.as_deref(),
        )?;
        if res.exit_code != 0 {
            return Err(GithubError::Validation(res.stderr.trim().to_string()));
        }
        Ok(res.stdout)
    })
    .await
    .map_err(|e| GithubError::Spawn(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests {
    use super::{
        command_succeeds, read_token_from, run_binary, run_with_timeout, token_failure_message,
        token_key, validate_token_with, GhRunResult, GithubError, BAD_CREDENTIALS_MESSAGE,
        CERTIFICATE_MESSAGE, EMPTY_TOKEN_MESSAGE, EXPIRED_MESSAGE, GH_PROBE_TIMEOUT, GH_TIMEOUT,
        MISSING_SCOPE_MESSAGE, NETWORK_MESSAGE, RATE_LIMIT_MESSAGE, TOKEN_KEY, UNVERIFIED_MESSAGE,
    };
    use std::process::Command;
    use std::time::{Duration, Instant};

    const MISSING_BIN: &str = "goodboy-no-such-binary";

    #[test]
    fn the_gh_call_path_gives_up_on_a_command_that_never_returns() {
        let started = Instant::now();
        let outcome = run_binary(
            "sleep",
            Duration::from_millis(150),
            &["30"],
            None,
            Some("ghp_token"),
        );
        assert!(
            matches!(outcome, Err(GithubError::Timeout)),
            "every gh call runs under the timeout, not a bare wait"
        );
        assert!(started.elapsed() < Duration::from_secs(10));
    }

    #[test]
    fn the_gh_call_path_still_returns_output_for_a_command_that_finishes() {
        let outcome = run_binary(
            "sh",
            GH_TIMEOUT,
            &["-c", "printf out; printf err >&2; exit 3"],
            None,
            None,
        )
        .expect("the command runs");
        assert_eq!(outcome.stdout, "out");
        assert_eq!(outcome.stderr, "err");
        assert_eq!(outcome.exit_code, 3);
    }

    #[test]
    fn a_gh_binary_that_is_not_installed_reads_as_a_missing_binary() {
        let outcome = run_binary(MISSING_BIN, GH_TIMEOUT, &["--version"], None, None);
        assert!(matches!(outcome, Err(GithubError::NotFound)));
    }

    #[test]
    fn the_availability_probe_gives_up_rather_than_hanging_the_boot_path() {
        let mut cmd = Command::new("sleep");
        cmd.arg("30");
        let started = Instant::now();
        assert!(!command_succeeds(cmd, Duration::from_millis(150)));
        assert!(started.elapsed() < Duration::from_secs(10));
    }

    #[test]
    fn the_availability_probe_still_reports_a_binary_that_answers() {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", "exit 0"]);
        assert!(command_succeeds(cmd, GH_PROBE_TIMEOUT));
    }

    #[test]
    fn a_hanging_gh_call_is_killed_once_the_timeout_passes() {
        let mut cmd = Command::new("sleep");
        cmd.arg("30");
        let started = Instant::now();
        let result = run_with_timeout(cmd, Duration::from_millis(150));
        assert!(matches!(result, Err(GithubError::Timeout)));
        assert!(started.elapsed() < Duration::from_secs(10));
    }

    #[test]
    fn a_timed_out_call_reports_it_rather_than_pretending_the_command_ran() {
        let mut cmd = Command::new("sleep");
        cmd.arg("30");
        let message = run_with_timeout(cmd, Duration::from_millis(150))
            .err()
            .map(|err| err.to_string())
            .unwrap_or_default();
        assert!(message.contains("stopped responding"));
    }

    #[test]
    fn a_command_that_finishes_keeps_its_output_and_exit_code() {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", "printf out; printf err >&2; exit 3"]);
        let result = run_with_timeout(cmd, GH_TIMEOUT).expect("command should run");
        assert_eq!(result.stdout, "out");
        assert_eq!(result.stderr, "err");
        assert_eq!(result.exit_code, 3);
    }

    #[test]
    fn the_gh_timeout_is_bounded_so_a_stuck_call_cannot_wedge_a_card() {
        assert!(GH_TIMEOUT <= Duration::from_secs(120));
    }

    fn gh_failure(stderr: &str) -> GhRunResult {
        GhRunResult {
            stdout: String::new(),
            stderr: stderr.to_string(),
            exit_code: 1,
        }
    }

    #[test]
    fn bad_credentials_reads_as_a_mistyped_token() {
        let message = token_failure_message("gh: Bad credentials (HTTP 401)\n", 1);
        assert_eq!(message, BAD_CREDENTIALS_MESSAGE);
        assert!(!message.contains("HTTP 401"));
    }

    #[test]
    fn an_expired_or_revoked_token_asks_for_a_new_one() {
        let message = token_failure_message("gh: Token expired, create a new one (HTTP 401)\n", 1);
        assert_eq!(message, EXPIRED_MESSAGE);
    }

    #[test]
    fn a_token_without_the_needed_scopes_names_the_scope() {
        let message = token_failure_message(
            "error: your authentication token is missing required scopes [repo]\n",
            1,
        );
        assert_eq!(message, MISSING_SCOPE_MESSAGE);
        assert!(message.contains("repo scope"));
    }

    #[test]
    fn a_network_failure_points_at_the_connection() {
        let message = token_failure_message(
            "Get \"https://api.github.com/user\": dial tcp: lookup api.github.com: no such host\n",
            1,
        );
        assert_eq!(message, NETWORK_MESSAGE);
    }

    #[test]
    fn the_six_causes_stay_distinguishable() {
        let messages = [
            token_failure_message("gh: Bad credentials (HTTP 401)", 1),
            token_failure_message("gh: the token has expired (HTTP 401)", 1),
            token_failure_message(
                "HTTP 403: Resource not accessible by personal access token",
                1,
            ),
            token_failure_message("dial tcp 140.82.121.6:443: i/o timeout", 1),
            token_failure_message(
                "gh: API rate limit exceeded for user ID 12345. (HTTP 403)",
                1,
            ),
            token_failure_message(
                "Get \"https://api.github.com/user\": tls: failed to verify certificate: x509: certificate signed by unknown authority",
                1,
            ),
        ];
        assert_eq!(
            messages,
            [
                BAD_CREDENTIALS_MESSAGE,
                EXPIRED_MESSAGE,
                MISSING_SCOPE_MESSAGE,
                NETWORK_MESSAGE,
                RATE_LIMIT_MESSAGE,
                CERTIFICATE_MESSAGE,
            ]
            .map(str::to_string),
            "each cause keeps its own written message"
        );
        let mut unique = messages.to_vec();
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), 6, "each cause needs its own message");
    }

    #[test]
    fn an_expired_certificate_is_not_read_as_an_expired_token() {
        let message = token_failure_message(
            "Get \"https://api.github.com/user\": tls: failed to verify certificate: x509: certificate has expired or is not yet valid: current time 2026-08-06T10:00:00Z is after 2025-01-01T00:00:00Z",
            1,
        );
        assert_eq!(message, CERTIFICATE_MESSAGE);
        assert_ne!(message, EXPIRED_MESSAGE);
    }

    #[test]
    fn an_untrusted_chain_points_at_the_proxy_not_the_token() {
        let message = token_failure_message(
            "Get \"https://api.github.com/user\": tls: failed to verify certificate: x509: certificate signed by unknown authority",
            1,
        );
        assert_eq!(message, CERTIFICATE_MESSAGE);
    }

    #[test]
    fn a_rate_limited_token_is_not_read_as_a_scope_problem() {
        let message = token_failure_message(
            "gh: API rate limit exceeded for user ID 12345. (HTTP 403)",
            1,
        );
        assert_eq!(message, RATE_LIMIT_MESSAGE);
        assert_ne!(message, MISSING_SCOPE_MESSAGE);
    }

    #[test]
    fn a_secondary_rate_limit_reads_the_same_way() {
        let message = token_failure_message(
            "gh: You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (HTTP 403)",
            1,
        );
        assert_eq!(message, RATE_LIMIT_MESSAGE);
    }

    #[test]
    fn the_gh_wording_for_an_offline_machine_reads_as_a_network_failure() {
        let message = token_failure_message(
            "error connecting to api.github.com/user\ncheck your internet connection or https://githubstatus.com",
            1,
        );
        assert_eq!(message, NETWORK_MESSAGE);
        assert!(!message.contains("githubstatus.com"));
    }

    #[test]
    fn saml_enforcement_reads_as_a_scope_problem() {
        let message = token_failure_message(
            "HTTP 403: Resource protected by organization SAML enforcement. You must grant your token access to this organization.",
            1,
        );
        assert_eq!(message, MISSING_SCOPE_MESSAGE);
    }

    #[test]
    fn an_unrecognised_failure_keeps_the_first_line_of_gh_output() {
        let message = token_failure_message("gh: something new went wrong\nstack noise\n", 7);
        assert_eq!(
            message,
            format!("{UNVERIFIED_MESSAGE} gh said: gh: something new went wrong")
        );
        assert!(!message.contains("stack noise"));
    }

    #[test]
    fn a_silent_failure_falls_back_to_the_exit_code() {
        assert_eq!(
            token_failure_message("   \n", 12),
            format!("{UNVERIFIED_MESSAGE} gh exited with 12.")
        );
    }

    #[test]
    fn a_rejected_token_renders_the_written_message_alone() {
        let rendered = GithubError::TokenRejected(BAD_CREDENTIALS_MESSAGE.to_string()).to_string();
        assert_eq!(rendered, BAD_CREDENTIALS_MESSAGE);
    }

    #[test]
    fn a_rejected_token_serialises_to_a_bare_string() {
        let payload = serde_json::to_string(&GithubError::TokenRejected(
            BAD_CREDENTIALS_MESSAGE.to_string(),
        ))
        .expect("the error serialises");
        assert_eq!(
            payload,
            serde_json::to_string(BAD_CREDENTIALS_MESSAGE).expect("the message serialises"),
            "the frontend reads the rejection as a plain string, not a tagged object"
        );
    }

    #[test]
    fn a_missing_gh_binary_serialises_to_a_bare_string() {
        let payload = serde_json::to_string(&GithubError::NotFound).expect("the error serialises");
        assert_eq!(
            payload,
            serde_json::to_string(&GithubError::NotFound.to_string())
                .expect("the message serialises"),
            "the frontend reads the missing binary as a plain string, not a tagged object"
        );
    }

    #[test]
    fn a_missing_gh_binary_tells_the_user_what_to_do() {
        let rendered = GithubError::NotFound.to_string();
        assert!(rendered.contains("cli.github.com"));
        assert!(rendered.contains("restart Goodboy"));
    }

    #[test]
    fn setting_a_rejected_token_surfaces_the_written_message_with_no_prefix() {
        let err = validate_token_with("ghp_bad", |_| {
            Ok(gh_failure("gh: Bad credentials (HTTP 401)"))
        })
        .expect_err("a non-zero exit rejects the token");
        assert_eq!(err.to_string(), BAD_CREDENTIALS_MESSAGE);
        assert!(matches!(err, GithubError::TokenRejected(_)));
    }

    #[test]
    fn setting_an_empty_token_surfaces_the_written_message_with_no_prefix() {
        let err = validate_token_with("   ", |_| panic!("gh must not run for an empty token"))
            .expect_err("an empty token is rejected before gh runs");
        assert_eq!(err.to_string(), EMPTY_TOKEN_MESSAGE);
        assert!(matches!(err, GithubError::TokenRejected(_)));
    }

    #[test]
    fn setting_a_token_without_gh_installed_surfaces_the_install_message() {
        let err = validate_token_with("ghp_ok", |_| Err(GithubError::NotFound))
            .expect_err("a missing binary is an error");
        assert_eq!(err.to_string(), GithubError::NotFound.to_string());
    }

    #[test]
    fn setting_a_valid_token_passes_the_untrimmed_value_to_gh() {
        let mut seen = String::new();
        let outcome = validate_token_with(" ghp_ok ", |candidate| {
            seen = candidate.to_string();
            Ok(GhRunResult {
                stdout: "octocat\n".to_string(),
                stderr: String::new(),
                exit_code: 0,
            })
        });
        assert!(outcome.is_ok());
        assert_eq!(seen, " ghp_ok ");
    }

    #[test]
    fn token_fallback_prefers_workspace_then_member_then_global() {
        let workspace_key = token_key(Some("composite"));
        let member_key = token_key(Some("member"));
        let mut reads = Vec::new();
        let token = read_token_from(Some("composite"), Some("member"), |key| {
            reads.push(key.to_string());
            (key == member_key).then(|| "member-token".to_string())
        });

        assert_eq!(token.as_deref(), Some("member-token"));
        assert_eq!(reads, vec![workspace_key, member_key]);

        let mut global_reads = Vec::new();
        let global = read_token_from(Some("composite"), Some("member"), |key| {
            global_reads.push(key.to_string());
            (key == TOKEN_KEY).then(|| "global-token".to_string())
        });

        assert_eq!(global.as_deref(), Some("global-token"));
        assert_eq!(
            global_reads,
            vec![
                token_key(Some("composite")),
                token_key(Some("member")),
                TOKEN_KEY.to_string(),
            ]
        );
    }

    #[test]
    fn clearing_one_workspace_token_leaves_the_global_key_serving_that_workspace() {
        let cleared = token_key(Some("composite"));
        let mut reads = Vec::new();
        let token = read_token_from(Some("composite"), None, |key| {
            reads.push(key.to_string());
            (key == TOKEN_KEY).then(|| "global-token".to_string())
        });

        assert_eq!(token.as_deref(), Some("global-token"));
        assert_eq!(reads, vec![cleared, TOKEN_KEY.to_string()]);
    }

    #[test]
    fn explicit_workspace_token_wins_before_member() {
        let workspace_key = token_key(Some("composite"));
        let mut reads = Vec::new();
        let token = read_token_from(Some("composite"), Some("member"), |key| {
            reads.push(key.to_string());
            (key == workspace_key).then(|| "workspace-token".to_string())
        });

        assert_eq!(token.as_deref(), Some("workspace-token"));
        assert_eq!(reads, vec![workspace_key]);
    }
}
