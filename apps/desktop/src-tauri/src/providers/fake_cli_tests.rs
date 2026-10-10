use super::*;
use crate::fake_cli::FakeCli;

const EMAIL: &str = "avery@harborline.test";

const QUICK: Budget = Budget {
    timeout: Duration::from_millis(1500),
    retry_delay: Duration::from_millis(50),
};

fn spawned_pids(binary: &str) -> Vec<u32> {
    let dir = std::path::Path::new(binary)
        .parent()
        .expect("the binary has a dir");
    std::fs::read_to_string(dir.join("probe.pid"))
        .unwrap_or_default()
        .lines()
        .filter_map(|line| line.trim().parse().ok())
        .collect()
}

fn stat_of(pid: u32) -> String {
    let out = std::process::Command::new("ps")
        .args(["-o", "stat=", "-p", &pid.to_string()])
        .output()
        .expect("run ps");
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

fn assert_every_probe_was_reaped(binary: &str) {
    let pids = spawned_pids(binary);
    assert!(!pids.is_empty(), "the slow fake never recorded a pid");
    for pid in pids {
        assert_eq!(stat_of(pid), "", "pid {pid} is still in the process table");
    }
}

#[test]
fn detection_reads_the_version_each_fake_cli_prints() {
    let fake = FakeCli::stage("ok");
    let cases = [
        ("anthropic", "claude", "2.1.4 (Claude Code)"),
        ("cursor", "cursor-agent", "2026.09.17-fake"),
        ("codex", "codex", "codex-cli 0.130.0"),
        ("gemini", "agy", "agy 1.1.9"),
    ];
    for (id, binary, version) in cases {
        let path = fake.binary(binary);

        let status = detect_binary(id, &path);

        assert_eq!(
            status,
            ProviderStatus {
                id: id.to_string(),
                binary: path.clone(),
                available: true,
                version: Some(version.to_string()),
                error: None,
                path: Some(path),
                error_kind: None,
            }
        );
    }
}

#[test]
fn detection_reports_the_exit_code_of_a_cli_that_cannot_start() {
    let fake = FakeCli::stage("version-fail");
    let path = fake.binary("codex");

    let status = detect_binary("codex", &path);

    assert!(!status.available);
    assert_eq!(status.version, None);
    assert_eq!(status.error.as_deref(), Some("exited with code 1"));
    assert_eq!(status.error_kind, Some(ProbeErrorKind::Exit));
}

#[test]
fn detection_gives_up_on_a_hung_cli_and_reaps_it() {
    let fake = FakeCli::stage("version-hang");
    let path = fake.binary("claude");
    path_env::resolved_path();
    let started = Instant::now();

    let status = detect_binary_within("anthropic", &path, QUICK);

    assert!(!status.available);
    assert_eq!(status.error.as_deref(), Some("detection timed out"));
    assert_eq!(status.error_kind, Some(ProbeErrorKind::Timeout));
    assert!(started.elapsed() < Duration::from_secs(6));
    assert_eq!(spawned_pids(&path).len(), 2);
    assert_every_probe_was_reaped(&path);
}

#[test]
fn detection_reports_a_missing_binary_as_not_found() {
    let fake = FakeCli::stage("ok");
    let path = fake.binary("no-such-cli");

    let status = detect_binary("codex", &path);

    assert!(!status.available);
    assert_eq!(status.version, None);
    assert!(status.error.is_some());
    assert_eq!(status.error_kind, Some(ProbeErrorKind::NotFound));
}

#[test]
fn a_slow_cli_is_never_reported_as_missing() {
    let fake = FakeCli::stage("slow");
    let path = fake.binary("agy");
    path_env::resolved_path();

    let status = detect_binary_within("gemini", &path, QUICK);

    assert_eq!(status.error_kind, Some(ProbeErrorKind::Timeout));
    assert_ne!(status.error_kind, Some(ProbeErrorKind::NotFound));
}

#[test]
fn claude_auth_reads_identity_and_plan_from_the_status_json() {
    let fake = FakeCli::stage("ok");

    let auth = check_claude_auth_with(&fake.binary("claude"), AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity.as_deref(), Some(EMAIL));
    assert_eq!(auth.plan.as_deref(), Some("max"));
    assert!(auth.verified);
    assert_eq!(auth.reason, None);
}

#[test]
fn claude_auth_reads_a_logged_out_status_that_exits_1_as_disconnected() {
    let fake = FakeCli::stage("logged-out");

    let auth = check_claude_auth_with(&fake.binary("claude"), AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Disconnected);
    assert_eq!(auth.identity, None);
    assert_eq!(auth.reason, None);
}

#[test]
fn claude_auth_keeps_an_unrecognised_answer_unknown_with_its_reason() {
    let fake = FakeCli::stage("garbage");

    let auth = check_claude_auth_with(&fake.binary("claude"), AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Unknown);
    assert_eq!(auth.reason.as_deref(), Some("something new and unexpected"));
}

#[test]
fn claude_auth_is_unknown_when_the_cli_hangs_and_the_probe_is_reaped() {
    let fake = FakeCli::stage("slow");
    let path = fake.binary("claude");
    path_env::resolved_path();

    let auth = check_claude_auth_with(&path, QUICK);

    assert_eq!(auth.state, AuthStateKind::Unknown);
    assert_eq!(
        auth.reason.as_deref(),
        Some("the CLI did not answer in time")
    );
    assert_every_probe_was_reaped(&path);
}

#[test]
fn claude_auth_is_unknown_when_the_binary_is_missing() {
    let fake = FakeCli::stage("ok");

    let auth = check_claude_auth_with(&fake.binary("no-such-cli"), AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Unknown);
    assert_eq!(auth.reason.as_deref(), Some("the CLI is not installed"));
}

#[test]
fn cursor_auth_confirmed_by_the_server_is_verified() {
    let fake = FakeCli::stage("confirmed");

    let auth = check_cursor_auth_with(&fake.binary("cursor-agent"), AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity.as_deref(), Some(EMAIL));
    assert!(auth.verified);
    assert_eq!(auth.reason, None);
}

#[test]
fn cursor_auth_with_local_tokens_only_is_connected_but_not_verified() {
    let fake = FakeCli::stage("unable-to-fetch");

    let auth = check_cursor_auth_with(&fake.binary("cursor-agent"), AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity, None);
    assert!(!auth.verified);
    assert_eq!(
        auth.reason.as_deref(),
        Some("Logged in (unable to fetch user details)")
    );
}

#[test]
fn cursor_auth_reads_a_logged_out_json_that_exits_1_as_disconnected() {
    let fake = FakeCli::stage("logged-out");

    let auth = check_cursor_auth_with(&fake.binary("cursor-agent"), AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Disconnected);
}

#[test]
fn cursor_auth_falls_back_to_the_text_status_written_to_stderr() {
    let fake = FakeCli::stage("text-status");

    let auth = check_cursor_auth_with(&fake.binary("cursor-agent"), AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity.as_deref(), Some(EMAIL));
    assert!(auth.verified);
}

#[test]
fn cursor_auth_is_unknown_when_the_cli_hangs_and_the_probe_is_reaped() {
    let fake = FakeCli::stage("slow");
    let path = fake.binary("cursor-agent");
    path_env::resolved_path();

    let auth = check_cursor_auth_with(&path, QUICK);

    assert_eq!(auth.state, AuthStateKind::Unknown);
    assert_every_probe_was_reaped(&path);
}

#[test]
fn codex_auth_reads_a_login_status_written_to_stderr() {
    let fake = FakeCli::stage("ok");

    let auth = check_codex_auth_with(&fake.binary("codex"), CODEX_AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity.as_deref(), Some(EMAIL));
}

#[test]
fn codex_auth_reads_not_logged_in_with_exit_1_as_disconnected() {
    let fake = FakeCli::stage("logged-out");

    let auth = check_codex_auth_with(&fake.binary("codex"), CODEX_AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Disconnected);
}

#[test]
fn codex_auth_falls_back_to_the_older_status_subcommand() {
    let fake = FakeCli::stage("legacy-status");

    let auth = check_codex_auth_with(&fake.binary("codex"), CODEX_AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity.as_deref(), Some(EMAIL));
}

#[test]
fn codex_auth_is_unknown_with_a_reason_when_no_subcommand_is_understood() {
    let fake = FakeCli::stage("unsupported");

    let auth = check_codex_auth_with(&fake.binary("codex"), CODEX_AUTH_BUDGET);

    assert_eq!(auth.state, AuthStateKind::Unknown);
    assert_eq!(auth.identity, None);
    assert!(auth.reason.is_some());
}

#[test]
fn codex_auth_stops_at_its_budget_when_the_cli_hangs() {
    let fake = FakeCli::stage("auth-hang");
    let path = fake.binary("codex");
    path_env::resolved_path();
    let started = Instant::now();

    let auth = check_codex_auth_with(&path, QUICK);

    assert_eq!(auth.state, AuthStateKind::Unknown);
    assert!(started.elapsed() < Duration::from_secs(6));
    assert_every_probe_was_reaped(&path);
}
