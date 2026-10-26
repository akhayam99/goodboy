use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime};

use crate::proc::probe;
use crate::providers::cli_args::{
    needs_workspace_trust, partial_output_flag, role_access, Cli, RoleAccess, CURSOR_TRUST_FLAG,
};
use crate::util::lock_or_recover;

const PROBE_TIMEOUT: Duration = Duration::from_secs(8);
const AUTO_ROLE: &str = "auto";

type Verdict = Result<(), String>;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct BinaryId {
    path: PathBuf,
    len: u64,
    modified: Option<SystemTime>,
}

type CacheKey = (BinaryId, &'static str);

fn cache() -> &'static Mutex<HashMap<CacheKey, Verdict>> {
    static CACHE: OnceLock<Mutex<HashMap<CacheKey, Verdict>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn versions() -> &'static Mutex<HashMap<BinaryId, String>> {
    static VERSIONS: OnceLock<Mutex<HashMap<BinaryId, String>>> = OnceLock::new();
    VERSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn binary_id(binary: &str) -> Option<BinaryId> {
    let found = crate::path_env::which(binary)?;
    let path = std::fs::canonicalize(&found).unwrap_or_else(|_| PathBuf::from(&found));
    let meta = std::fs::metadata(&path).ok()?;
    Some(BinaryId {
        path,
        len: meta.len(),
        modified: meta.modified().ok(),
    })
}

fn required_flags(cli: Cli, access: RoleAccess) -> &'static [&'static str] {
    match (cli, access) {
        (Cli::Claude, RoleAccess::ReadOnly) => {
            &["--tools", "--disallowedTools", "--permission-mode"]
        }
        (Cli::Claude, RoleAccess::Writer) => &["--disallowedTools", "--add-dir"],
        (Cli::Codex, RoleAccess::ReadOnly) => &["--sandbox"],
        (Cli::Codex, RoleAccess::Writer) => &["--sandbox", "--add-dir"],
        (Cli::Cursor, _) => &["--mode"],
        (Cli::Agy, _) => &["--mode", "--sandbox"],
        (Cli::Opencode, _) => &["--agent"],
    }
}

fn help_args(cli: Cli) -> &'static [&'static str] {
    match cli {
        Cli::Codex => &["exec", "--help"],
        _ => &["--help"],
    }
}

pub(crate) fn missing_flags(cli: Cli, access: RoleAccess, help: &str) -> Vec<&'static str> {
    required_flags(cli, access)
        .iter()
        .filter(|flag| !help.contains(*flag))
        .copied()
        .collect()
}

pub(crate) fn version_of(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| line.chars().any(|ch| ch.is_ascii_digit()))
        .map(str::to_string)
}

fn run_text(binary: &str, args: &[&str]) -> Result<String, String> {
    let mut command = crate::path_env::command(binary);
    command.args(args);
    let output = probe::run(command, Instant::now() + PROBE_TIMEOUT)
        .map_err(|error| format!("{binary} did not start: {error}"))?;
    if output.timed_out {
        return Err(format!(
            "{binary} {} did not answer in time",
            args.join(" ")
        ));
    }
    Ok(format!("{}\n{}", output.stdout, output.stderr))
}

fn judge(binary: &str, cli: Cli, access: RoleAccess, version: &str) -> Result<Verdict, String> {
    let help = run_text(binary, help_args(cli))?;
    let missing = missing_flags(cli, access, &help);
    if missing.is_empty() {
        return Ok(Ok(()));
    }
    Ok(Err(format!(
        "{binary} {version} does not list {}",
        missing.join(", ")
    )))
}

fn access_label(access: RoleAccess) -> &'static str {
    match access {
        RoleAccess::ReadOnly => "read_only",
        RoleAccess::Writer => "writer",
    }
}

pub(crate) fn version_cached(binary: &str) -> Option<String> {
    let id = binary_id(binary);
    if let Some(known) = id
        .as_ref()
        .and_then(|id| lock_or_recover(versions()).get(id).cloned())
    {
        return Some(known);
    }
    let version = version_of(&run_text(binary, &["--version"]).ok()?)?;
    if let Some(id) = id {
        lock_or_recover(versions()).insert(id, version.clone());
    }
    Some(version)
}

pub(crate) fn ensure_confinement(binary: &str, role: &str) -> Verdict {
    let access = role_access(role).ok_or_else(|| format!("role {role} is not a confined role"))?;
    let cli =
        Cli::of_binary(binary).ok_or_else(|| format!("{binary} is not a binary Goodboy drives"))?;
    if role == AUTO_ROLE && cli == Cli::Opencode {
        return Err(
            "auto does not run on opencode: its plan agent still asks before a shell command and the run flag approves it"
                .to_string(),
        );
    }
    let id = binary_id(binary);
    let label = access_label(access);
    if let Some(known) = id
        .as_ref()
        .and_then(|id| lock_or_recover(cache()).get(&(id.clone(), label)).cloned())
    {
        return known;
    }
    let version = match id.as_ref() {
        Some(_) => version_cached(binary),
        None => version_of(&run_text(binary, &["--version"])?),
    }
    .ok_or_else(|| format!("{binary} did not report a version"))?;
    let verdict = judge(binary, cli, access, &version)?;
    if let Some(id) = id {
        lock_or_recover(cache()).insert((id, label), verdict.clone());
    }
    verdict
}

fn lists_flag(binary: &str, flag: &'static str) -> bool {
    let id = binary_id(binary);
    if let Some(known) = id
        .as_ref()
        .and_then(|id| lock_or_recover(cache()).get(&(id.clone(), flag)).cloned())
    {
        return known.is_ok();
    }
    let Some(cli) = Cli::of_binary(binary) else {
        return false;
    };
    let Ok(help) = run_text(binary, help_args(cli)) else {
        return false;
    };
    let verdict: Verdict = help
        .contains(flag)
        .then_some(())
        .ok_or_else(|| format!("{binary} does not list {flag}"));
    let listed = verdict.is_ok();
    if let Some(id) = id {
        lock_or_recover(cache()).insert((id, flag), verdict);
    }
    listed
}

pub(crate) fn partial_output_args(binary: &str) -> Vec<String> {
    match Cli::of_binary(binary).and_then(partial_output_flag) {
        Some(flag) if lists_flag(binary, flag) => vec![flag.to_string()],
        _ => Vec::new(),
    }
}

pub(crate) fn workspace_trust_args(binary: &str, argv: &[String]) -> Vec<String> {
    let Some(cli) = Cli::of_binary(binary) else {
        return Vec::new();
    };
    if needs_workspace_trust(cli, argv) && lists_flag(binary, CURSOR_TRUST_FLAG) {
        return vec![CURSOR_TRUST_FLAG.to_string()];
    }
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    const CLAUDE_HELP: &str = "Options:\n  --tools <tools...>  Specify the list of available tools\n  --disallowedTools <tools...>\n  --permission-mode <mode>\n  --add-dir <directories...>\n";

    #[test]
    fn a_help_that_lists_every_flag_proves_the_role() {
        assert!(missing_flags(Cli::Claude, RoleAccess::ReadOnly, CLAUDE_HELP).is_empty());
        assert!(missing_flags(Cli::Claude, RoleAccess::Writer, CLAUDE_HELP).is_empty());
    }

    #[test]
    fn a_help_without_the_tools_flag_fails_closed_for_a_read_only_role() {
        let help = CLAUDE_HELP.replace(
            "--tools <tools...>  Specify the list of available tools\n",
            "",
        );
        assert_eq!(
            missing_flags(Cli::Claude, RoleAccess::ReadOnly, &help),
            vec!["--tools"]
        );
        assert!(missing_flags(Cli::Claude, RoleAccess::Writer, &help).is_empty());
    }

    #[test]
    fn every_cli_names_the_flags_its_roles_depend_on() {
        for cli in [
            Cli::Claude,
            Cli::Cursor,
            Cli::Agy,
            Cli::Codex,
            Cli::Opencode,
        ] {
            for access in [RoleAccess::ReadOnly, RoleAccess::Writer] {
                assert!(!required_flags(cli, access).is_empty());
            }
        }
        assert_eq!(help_args(Cli::Codex), &["exec", "--help"]);
        assert_eq!(help_args(Cli::Claude), &["--help"]);
    }

    #[test]
    fn the_version_is_the_first_line_with_a_digit() {
        assert_eq!(
            version_of("\n2.1.40 (Claude Code)\n").as_deref(),
            Some("2.1.40 (Claude Code)")
        );
        assert_eq!(
            version_of("codex-cli 0.58.0").as_deref(),
            Some("codex-cli 0.58.0")
        );
        assert_eq!(version_of("no number here"), None);
    }

    #[test]
    fn auto_is_proved_like_a_scout_on_every_cli() {
        assert!(role_access("auto") == Some(RoleAccess::ReadOnly));
        let refusal = ensure_confinement("/nonexistent/codex", "auto").expect_err("refused");
        assert!(refusal.contains("did not start"));
        assert!(missing_flags(Cli::Claude, RoleAccess::ReadOnly, CLAUDE_HELP).is_empty());
        for cli in [Cli::Codex, Cli::Cursor, Cli::Agy, Cli::Opencode] {
            assert_eq!(
                required_flags(cli, role_access("auto").expect("a role")),
                required_flags(cli, role_access("scout").expect("a role"))
            );
        }
    }

    #[test]
    fn auto_is_refused_on_every_opencode_binary_before_any_probe_runs() {
        for binary in ["opencode", "/nonexistent/opencode"] {
            let refusal = ensure_confinement(binary, "auto").expect_err("refused");
            assert!(
                refusal.contains("auto does not run on opencode"),
                "{refusal}"
            );
            assert!(!refusal.contains("did not start"), "{refusal}");
        }
        let scout = ensure_confinement("/nonexistent/opencode", "scout").expect_err("refused");
        assert!(scout.contains("did not start"));
    }

    #[test]
    fn an_unknown_role_is_not_confined_and_a_missing_binary_is_refused() {
        assert!(ensure_confinement("claude", "generalist").is_err());
        let refusal = ensure_confinement("/nonexistent/claude", "scout").expect_err("refused");
        assert!(refusal.contains("did not start"));
    }

    #[test]
    fn a_binary_that_is_not_one_of_ours_is_refused_before_any_probe_runs() {
        for binary in ["openrouter", "moonshot", "/nonexistent/goodboy-cli"] {
            let refusal = ensure_confinement(binary, "scout").expect_err("refused");
            assert!(refusal.contains("not a binary Goodboy drives"), "{refusal}");
        }
    }

    #[cfg(unix)]
    fn runnable(path: &std::path::Path) {
        for _ in 0..500 {
            match std::process::Command::new(path).arg("--version").output() {
                Err(error) if error.raw_os_error() == Some(libc::ETXTBSY) => {
                    std::thread::sleep(Duration::from_millis(10));
                }
                _ => return,
            }
        }
    }

    #[cfg(unix)]
    fn script_cli(dir: &std::path::Path, version: &str, help: &str) -> String {
        use std::os::unix::fs::PermissionsExt;
        let path = dir.join("claude");
        let body = format!(
            "#!/bin/sh\ncase \"$1\" in\n  --version) echo '{version}';;\n  --help) printf '%s\\n' '{help}';;\nesac\n"
        );
        std::fs::write(&path, body).expect("write the script");
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).expect("chmod");
        runnable(&path);
        path.to_string_lossy().into_owned()
    }

    #[cfg(unix)]
    #[test]
    fn the_verdict_follows_the_version_of_the_binary() {
        let dir = std::env::temp_dir().join(format!("goodboy-cli-probe-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let old = script_cli(
            &dir,
            "2.0.1 (Claude Code)",
            "--disallowedTools --permission-mode",
        );
        let refusal = ensure_confinement(&old, "scout").expect_err("refused");
        assert!(refusal.contains("does not list --tools"), "{refusal}");
        assert_eq!(ensure_confinement(&old, "scout"), Err(refusal));
        assert!(ensure_confinement(&old, "implementer").is_err());
        let current = script_cli(
            &dir,
            "2.1.40 (Claude Code)",
            "--tools --disallowedTools --permission-mode --add-dir",
        );
        assert_eq!(current, old);
        assert_eq!(ensure_confinement(&current, "scout"), Ok(()));
        assert_eq!(ensure_confinement(&current, "implementer"), Ok(()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    fn counting_cli(dir: &std::path::Path, help: &str) -> (String, std::path::PathBuf) {
        use std::os::unix::fs::PermissionsExt;
        let path = dir.join("claude");
        let counter = dir.join("calls");
        let body = format!(
            "#!/bin/sh\necho \"$1\" >> '{}'\ncase \"$1\" in\n  --version) echo '2.1.40 (Claude Code)';;\n  --help) printf '%s\\n' '{help}';;\nesac\n",
            counter.display()
        );
        std::fs::write(&path, body).expect("write the script");
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).expect("chmod");
        runnable(&path);
        let _ = std::fs::remove_file(&counter);
        (path.to_string_lossy().into_owned(), counter)
    }

    #[cfg(unix)]
    fn calls_in(counter: &std::path::Path) -> usize {
        std::fs::read_to_string(counter)
            .map(|text| text.lines().count())
            .unwrap_or(0)
    }

    #[cfg(unix)]
    fn scratch(label: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-cli-{label}-{}-{:016x}",
            std::process::id(),
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[cfg(unix)]
    #[test]
    fn a_proved_role_costs_no_process_the_second_time() {
        let dir = scratch("verdict-cache");
        let (binary, counter) = counting_cli(
            &dir,
            "--tools --disallowedTools --permission-mode --add-dir",
        );

        assert_eq!(ensure_confinement(&binary, "scout"), Ok(()));
        assert_eq!(calls_in(&counter), 2);
        assert_eq!(ensure_confinement(&binary, "scout"), Ok(()));
        assert_eq!(ensure_confinement(&binary, "scout"), Ok(()));
        assert_eq!(calls_in(&counter), 2);
        assert_eq!(ensure_confinement(&binary, "implementer"), Ok(()));
        assert_eq!(calls_in(&counter), 3);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_changed_binary_is_probed_again() {
        let dir = scratch("verdict-change");
        let (binary, counter) = counting_cli(&dir, "--disallowedTools --permission-mode");
        let refusal = ensure_confinement(&binary, "scout").expect_err("old binary refused");
        assert!(refusal.contains("--tools"), "{refusal}");
        assert_eq!(calls_in(&counter), 2);

        let (same, _) = counting_cli(
            &dir,
            "--tools --disallowedTools --permission-mode --add-dir",
        );
        assert_eq!(same, binary);

        assert_eq!(ensure_confinement(&binary, "scout"), Ok(()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn the_version_is_read_once_per_binary() {
        let dir = scratch("version-cache");
        let (binary, counter) = counting_cli(&dir, "--tools");

        assert_eq!(
            version_cached(&binary).as_deref(),
            Some("2.1.40 (Claude Code)")
        );
        assert_eq!(
            version_cached(&binary).as_deref(),
            Some("2.1.40 (Claude Code)")
        );
        assert_eq!(calls_in(&counter), 1);
        assert_eq!(version_cached("/nonexistent/goodboy-cli"), None);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_flag_that_is_listed_is_looked_up_once() {
        let dir = scratch("flag-cache");
        let (binary, counter) = counting_cli(&dir, "--tools --include-partial-messages");

        assert_eq!(
            partial_output_args(&binary),
            vec!["--include-partial-messages".to_string()]
        );
        assert_eq!(
            partial_output_args(&binary),
            vec!["--include-partial-messages".to_string()]
        );
        assert_eq!(calls_in(&counter), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    fn script_with_help(dir: &std::path::Path, name: &str, help: &str) -> String {
        use std::os::unix::fs::PermissionsExt;
        let path = dir.join(name);
        let body = format!(
            "#!/bin/sh\ncase \"$1\" in\n  --version) echo '2.1.40 (Claude Code)';;\n  --help) printf '%s\\n' '{help}';;\nesac\n"
        );
        std::fs::write(&path, body).expect("write the script");
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).expect("chmod");
        runnable(&path);
        path.to_string_lossy().into_owned()
    }

    #[cfg(unix)]
    #[test]
    fn partial_output_is_asked_only_when_the_help_lists_the_flag() {
        let dir =
            std::env::temp_dir().join(format!("goodboy-partial-probe-{}", std::process::id()));
        let old_dir = dir.join("old");
        let new_dir = dir.join("new");
        std::fs::create_dir_all(&old_dir).expect("temp dir");
        std::fs::create_dir_all(&new_dir).expect("temp dir");
        let old = script_with_help(&old_dir, "claude", "--tools --add-dir");
        let current = script_with_help(
            &new_dir,
            "claude",
            "--tools --add-dir --include-partial-messages",
        );
        assert!(partial_output_args(&old).is_empty());
        assert!(partial_output_args(&old).is_empty());
        assert_eq!(
            partial_output_args(&current),
            vec!["--include-partial-messages".to_string()]
        );
        let cursor = script_with_help(&new_dir, "cursor-agent", "--stream-partial-output");
        assert_eq!(
            partial_output_args(&cursor),
            vec!["--stream-partial-output".to_string()]
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn workspace_trust_is_passed_when_the_cursor_help_lists_it_and_no_force_is_set() {
        let dir = std::env::temp_dir().join(format!("goodboy-trust-probe-{}", std::process::id()));
        let old_dir = dir.join("old");
        let new_dir = dir.join("new");
        std::fs::create_dir_all(&old_dir).expect("temp dir");
        std::fs::create_dir_all(&new_dir).expect("temp dir");
        let old = script_with_help(&old_dir, "cursor-agent", "--mode --stream-partial-output");
        let current = script_with_help(&new_dir, "cursor-agent", "--mode --force --trust");
        let read_only: Vec<String> = ["-p", "x", "--mode", "plan"]
            .iter()
            .map(|part| part.to_string())
            .collect();
        let writer: Vec<String> = ["-p", "x", "--force"]
            .iter()
            .map(|part| part.to_string())
            .collect();
        assert_eq!(
            workspace_trust_args(&current, &read_only),
            vec!["--trust".to_string()]
        );
        assert!(workspace_trust_args(&current, &writer).is_empty());
        assert!(workspace_trust_args(&old, &read_only).is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn workspace_trust_is_never_asked_of_another_cli_or_a_missing_binary() {
        let argv: Vec<String> = vec!["-p".to_string(), "x".to_string()];
        assert!(workspace_trust_args("/nonexistent/cursor-agent", &argv).is_empty());
        assert!(workspace_trust_args("/nonexistent/claude", &argv).is_empty());
        assert!(workspace_trust_args("codex", &argv).is_empty());
    }

    #[test]
    fn partial_output_is_never_asked_of_a_cli_without_the_flag_or_a_missing_binary() {
        assert!(partial_output_args("/nonexistent/claude").is_empty());
        assert!(partial_output_args("/nonexistent/codex").is_empty());
        assert!(partial_output_args("agy").is_empty());
    }
}
