use super::*;
use crate::fake_cli::FakeCli;

const SHORT: Duration = Duration::from_millis(300);
const EMAIL: &str = "avery@harborline.test";

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
}

#[test]
fn detection_gives_up_on_a_hung_cli_and_kills_it() {
    let fake = FakeCli::stage("version-hang");
    let path = fake.binary("claude");
    path_env::resolved_path();
    let started = Instant::now();

    let status = detect_binary_within("anthropic", &path, SHORT);

    assert!(!status.available);
    assert_eq!(status.error.as_deref(), Some("detection timed out"));
    assert!(started.elapsed() < Duration::from_millis(1500));
}

#[test]
fn detection_reports_a_missing_binary_as_unavailable() {
    let fake = FakeCli::stage("ok");
    let path = fake.binary("no-such-cli");

    let status = detect_binary("codex", &path);

    assert!(!status.available);
    assert_eq!(status.version, None);
    assert!(status.error.is_some());
}

#[test]
fn claude_auth_reads_identity_and_plan_from_the_status_json() {
    let fake = FakeCli::stage("ok");

    let auth = check_claude_auth_with(&fake.binary("claude"));

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity.as_deref(), Some(EMAIL));
    assert_eq!(auth.plan.as_deref(), Some("max"));
}

#[test]
fn claude_auth_reads_a_logged_out_status_as_disconnected() {
    let fake = FakeCli::stage("logged-out");

    let auth = check_claude_auth_with(&fake.binary("claude"));

    assert_eq!(auth.state, AuthStateKind::Disconnected);
    assert_eq!(auth.identity, None);
}

#[test]
fn cursor_auth_reads_a_status_written_to_stderr() {
    let fake = FakeCli::stage("ok");

    let auth = check_cursor_auth_with(&fake.binary("cursor-agent"));

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity.as_deref(), Some(EMAIL));
}

#[test]
fn codex_auth_reads_a_login_status_written_to_stderr() {
    let fake = FakeCli::stage("ok");

    let auth = check_codex_auth_with(&fake.binary("codex"), CODEX_AUTH_TIMEOUT);

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity.as_deref(), Some(EMAIL));
}

#[test]
fn codex_auth_falls_back_to_an_older_status_subcommand() {
    let fake = FakeCli::stage("legacy-status");

    let auth = check_codex_auth_with(&fake.binary("codex"), CODEX_AUTH_TIMEOUT);

    assert_eq!(auth.state, AuthStateKind::Connected);
    assert_eq!(auth.identity.as_deref(), Some(EMAIL));
}

#[test]
fn codex_auth_is_unknown_when_no_subcommand_is_understood() {
    let fake = FakeCli::stage("unsupported");

    let auth = check_codex_auth_with(&fake.binary("codex"), CODEX_AUTH_TIMEOUT);

    assert_eq!(auth.state, AuthStateKind::Unknown);
    assert_eq!(auth.identity, None);
}

#[test]
fn codex_auth_stops_at_its_budget_when_the_cli_hangs() {
    let fake = FakeCli::stage("auth-hang");
    path_env::resolved_path();
    let started = Instant::now();

    let auth = check_codex_auth_with(&fake.binary("codex"), SHORT);

    assert_eq!(auth.state, AuthStateKind::Unknown);
    assert!(started.elapsed() < Duration::from_secs(3));
}
