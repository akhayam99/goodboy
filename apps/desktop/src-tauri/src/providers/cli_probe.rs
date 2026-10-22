use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::proc::probe;
use crate::providers::cli_args::{partial_output_flag, role_access, Cli, RoleAccess};

const PROBE_TIMEOUT: Duration = Duration::from_secs(8);
const AUTO_ROLE: &str = "auto";

type Verdict = Result<(), String>;
type CacheKey = (String, String, &'static str);

fn cache() -> &'static Mutex<HashMap<CacheKey, Verdict>> {
    static CACHE: OnceLock<Mutex<HashMap<CacheKey, Verdict>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
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

fn judge(binary: &str, cli: Cli, access: RoleAccess, version: &str) -> Verdict {
    let help = run_text(binary, help_args(cli))?;
    let missing = missing_flags(cli, access, &help);
    if missing.is_empty() {
        return Ok(());
    }
    Err(format!(
        "{binary} {version} does not list {}",
        missing.join(", ")
    ))
}

fn access_label(access: RoleAccess) -> &'static str {
    match access {
        RoleAccess::ReadOnly => "read_only",
        RoleAccess::Writer => "writer",
    }
}

pub(crate) fn ensure_confinement(binary: &str, role: &str) -> Verdict {
    let access = role_access(role).ok_or_else(|| format!("role {role} is not a confined role"))?;
    let cli = Cli::of_binary(binary);
    if role == AUTO_ROLE && cli == Cli::Opencode {
        return Err(
            "auto does not run on opencode: its plan agent still asks before a shell command and the run flag approves it"
                .to_string(),
        );
    }
    let version = version_of(&run_text(binary, &["--version"])?)
        .ok_or_else(|| format!("{binary} did not report a version"))?;
    let key: CacheKey = (binary.to_string(), version.clone(), access_label(access));
    if let Some(known) = cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .get(&key)
    {
        return known.clone();
    }
    let verdict = judge(binary, cli, access, &version);
    cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .insert(key, verdict.clone());
    verdict
}

fn lists_flag(binary: &str, flag: &'static str) -> bool {
    let version = match run_text(binary, &["--version"])
        .ok()
        .as_deref()
        .and_then(version_of)
    {
        Some(version) => version,
        None => return false,
    };
    let key: CacheKey = (binary.to_string(), version, flag);
    if let Some(known) = cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .get(&key)
    {
        return known.is_ok();
    }
    let help = match run_text(binary, help_args(Cli::of_binary(binary))) {
        Ok(help) => help,
        Err(_) => return false,
    };
    let verdict: Verdict = help
        .contains(flag)
        .then_some(())
        .ok_or_else(|| format!("{binary} does not list {flag}"));
    let listed = verdict.is_ok();
    cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .insert(key, verdict);
    listed
}

pub(crate) fn partial_output_args(binary: &str) -> Vec<String> {
    match partial_output_flag(Cli::of_binary(binary)) {
        Some(flag) if lists_flag(binary, flag) => vec![flag.to_string()],
        _ => Vec::new(),
    }
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
        for binary in [
            "opencode",
            "/nonexistent/opencode",
            "openrouter",
            "moonshot",
        ] {
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
        let refusal = ensure_confinement("/nonexistent/goodboy-cli", "scout").expect_err("refused");
        assert!(refusal.contains("did not start"));
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

    #[test]
    fn partial_output_is_never_asked_of_a_cli_without_the_flag_or_a_missing_binary() {
        assert!(partial_output_args("/nonexistent/claude").is_empty());
        assert!(partial_output_args("/nonexistent/codex").is_empty());
        assert!(partial_output_args("agy").is_empty());
    }
}
