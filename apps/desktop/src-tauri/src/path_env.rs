use std::collections::HashSet;
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

static RESOLVED_PATH: OnceLock<String> = OnceLock::new();
static RESOLVED_ENV: OnceLock<Vec<(String, String)>> = OnceLock::new();

const PROBE_TIMEOUT: Duration = Duration::from_secs(3);
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// PATH inherited from the user's login shell, merged with the process's own
/// PATH and common install locations, deduplicated, cached after first call.
///
/// macOS GUI apps launched from Finder/Dock receive only the minimal posix
/// PATH (`/usr/bin:/bin:/usr/sbin:/sbin`), which excludes `/opt/homebrew/bin`
/// and other typical install dirs. Without this resolution, `Command::new`
/// fails with ENOENT for `claude`, `cursor-agent`, `codex`, `gh`,
/// brew-installed `git`, user editors, etc.
pub fn resolved_path() -> &'static str {
    RESOLVED_PATH.get_or_init(compute_path)
}

/// `Command` pre-wired with the resolved PATH. Drop-in replacement for
/// `Command::new` whenever the target binary may live outside the minimal
/// posix path set.
pub fn command(binary: &str) -> Command {
    let mut cmd = Command::new(binary);
    cmd.env("PATH", resolved_path());
    cmd
}

pub fn resolved_env() -> &'static [(String, String)] {
    RESOLVED_ENV.get_or_init(compute_env)
}

pub fn command_with_login_env(binary: &str) -> Command {
    let mut cmd = Command::new(binary);
    for (key, value) in resolved_env() {
        cmd.env(key, value);
    }
    cmd.env("PATH", resolved_path());
    cmd
}

pub fn login_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        let shell = shell.trim();
        if !shell.is_empty() && std::path::Path::new(shell).exists() {
            return shell.to_string();
        }
    }
    for candidate in shell_candidates() {
        if std::path::Path::new(candidate).exists() {
            return (*candidate).to_string();
        }
    }
    "/bin/sh".to_string()
}

fn compute_path() -> String {
    let inherited = std::env::var("PATH").unwrap_or_default();
    let (shell, npm_bin) = probe_login_shell();
    let shell = shell.unwrap_or_default();
    let npm_bin = npm_bin.unwrap_or_default();
    let common = common_install_paths();

    let mut parts: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for source in [
        shell.as_str(),
        inherited.as_str(),
        npm_bin.as_str(),
        common.as_str(),
    ] {
        for segment in source.split(':') {
            let segment = segment.trim();
            if !segment.is_empty() && seen.insert(segment.to_string()) {
                parts.push(segment.to_string());
            }
        }
    }
    parts.join(":")
}

#[cfg(target_os = "macos")]
fn shell_candidates() -> &'static [&'static str] {
    &["/bin/zsh", "/bin/bash", "/bin/sh"]
}

#[cfg(target_os = "linux")]
fn shell_candidates() -> &'static [&'static str] {
    &["/bin/bash", "/bin/zsh", "/bin/sh"]
}

#[cfg(target_os = "windows")]
fn shell_candidates() -> &'static [&'static str] {
    &[]
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn shell_candidates() -> &'static [&'static str] {
    &[]
}

const SHELL_PROBE_SCRIPT: &str =
    "printf 'GBPATH:%s\\n' \"$PATH\"; printf 'GBNPM:%s\\n' \"$(npm prefix -g 2>/dev/null)\"";

fn probe_login_shell() -> (Option<String>, Option<String>) {
    for sh in shell_candidates() {
        if !std::path::Path::new(sh).exists() {
            continue;
        }
        let args: &[&str] = if *sh == "/bin/sh" {
            &["-lc", SHELL_PROBE_SCRIPT]
        } else {
            &["-ilc", SHELL_PROBE_SCRIPT]
        };
        if let Some(out) = run_with_timeout(sh, args) {
            let (path, prefix) = parse_shell_probe(&out);
            if path.is_none() {
                continue;
            }
            let npm_bin = prefix
                .map(|p| format!("{p}/bin"))
                .filter(|bin| std::path::Path::new(bin).is_dir());
            return (path, npm_bin);
        }
    }
    (None, None)
}

fn parse_shell_probe(out: &str) -> (Option<String>, Option<String>) {
    let mut path = None;
    let mut prefix = None;
    for line in out.lines() {
        if let Some(rest) = line.strip_prefix("GBPATH:") {
            let value = rest.trim();
            if !value.is_empty() {
                path = Some(value.to_string());
            }
        } else if let Some(rest) = line.strip_prefix("GBNPM:") {
            let value = rest.trim();
            if !value.is_empty() {
                prefix = Some(value.to_string());
            }
        }
    }
    (path, prefix)
}

fn compute_env() -> Vec<(String, String)> {
    parse_env(&probe_login_shell_env().unwrap_or_default())
}

fn parse_env(raw: &str) -> Vec<(String, String)> {
    let mut out: Vec<(String, String)> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for line in raw.lines() {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        if key.is_empty() || key.contains(char::is_whitespace) {
            continue;
        }
        if seen.insert(key.to_string()) {
            out.push((key.to_string(), value.to_string()));
        }
    }
    out
}

fn probe_login_shell_env() -> Option<String> {
    const LOGIN_ARGS: &[&str] = &["-ilc", "env"];
    const POSIX_ARGS: &[&str] = &["-lc", "env"];
    for sh in shell_candidates() {
        if !std::path::Path::new(sh).exists() {
            continue;
        }
        let args = if *sh == "/bin/sh" {
            POSIX_ARGS
        } else {
            LOGIN_ARGS
        };
        if let Some(out) = run_with_timeout(sh, args) {
            let trimmed = out.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn run_with_timeout(bin: &str, args: &[&str]) -> Option<String> {
    let mut child = Command::new(bin)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .spawn()
        .ok()?;

    let deadline = Instant::now() + PROBE_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut buf = String::new();
                if let Some(mut out) = child.stdout.take() {
                    let _ = out.read_to_string(&mut buf);
                }
                return if status.success() { Some(buf) } else { None };
            }
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    return None;
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(_) => return None,
        }
    }
}

fn common_install_paths() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut parts: Vec<String> = vec![
        "/opt/homebrew/bin".into(),
        "/opt/homebrew/sbin".into(),
        "/usr/local/bin".into(),
        "/usr/local/sbin".into(),
        "/usr/bin".into(),
        "/bin".into(),
        "/usr/sbin".into(),
        "/sbin".into(),
    ];
    if !home.is_empty() {
        for sub in &[
            "/.bun/bin",
            "/.cargo/bin",
            "/.local/bin",
            "/.deno/bin",
            "/.volta/bin",
            "/.npm-global/bin",
        ] {
            parts.push(format!("{}{}", home, sub));
        }
    }
    parts.join(":")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolved_path_is_non_empty_and_contains_bin() {
        let p = resolved_path();
        assert!(!p.is_empty(), "resolved PATH must not be empty");
        assert!(
            p.split(':').any(|seg| seg == "/bin"),
            "resolved PATH should include /bin, got: {}",
            p
        );
    }

    #[test]
    fn command_inherits_resolved_path() {
        let cmd = command("true");
        let env = cmd
            .get_envs()
            .find(|(k, _)| *k == std::ffi::OsStr::new("PATH"));
        assert!(env.is_some(), "command must set PATH env var");
        let (_, val) = env.unwrap();
        assert!(val.is_some());
        assert_eq!(val.unwrap(), std::ffi::OsStr::new(resolved_path()));
    }

    #[test]
    fn compute_path_dedups_segments() {
        let merged = compute_path();
        let segments: Vec<&str> = merged.split(':').collect();
        let mut unique = HashSet::new();
        for s in &segments {
            assert!(
                unique.insert(*s),
                "duplicate segment in resolved PATH: {}",
                s
            );
        }
    }

    #[test]
    fn parse_env_keeps_first_value_and_skips_malformed() {
        let raw =
            "PATH=/usr/bin\nGITHUB_PACKAGES_TOKEN=abc=123\nNOEQUALS\n bad key=x\nPATH=/override\n";
        let env = parse_env(raw);
        assert_eq!(
            env.iter()
                .find(|(k, _)| k == "GITHUB_PACKAGES_TOKEN")
                .map(|(_, v)| v.as_str()),
            Some("abc=123")
        );
        assert!(env.iter().all(|(k, _)| k != "NOEQUALS"));
        assert!(env.iter().all(|(k, _)| !k.contains(' ')));
        assert_eq!(
            env.iter().filter(|(k, _)| k == "PATH").count(),
            1,
            "duplicate keys collapse to the first occurrence"
        );
    }

    #[test]
    fn parse_shell_probe_extracts_path_and_npm_prefix_ignoring_noise() {
        let raw = "welcome from .zshrc\nGBPATH:/opt/homebrew/bin:/usr/bin\nGBNPM:/Users/x/.nvm/versions/node/v20/bin/..\n";
        let (path, prefix) = parse_shell_probe(raw);
        assert_eq!(path.as_deref(), Some("/opt/homebrew/bin:/usr/bin"));
        assert_eq!(
            prefix.as_deref(),
            Some("/Users/x/.nvm/versions/node/v20/bin/..")
        );
    }

    #[test]
    fn parse_shell_probe_drops_empty_npm_prefix() {
        let raw = "GBPATH:/usr/bin\nGBNPM:\n";
        let (path, prefix) = parse_shell_probe(raw);
        assert_eq!(path.as_deref(), Some("/usr/bin"));
        assert_eq!(prefix, None);
    }

    #[test]
    fn command_with_login_env_sets_path() {
        let cmd = command_with_login_env("true");
        let env = cmd
            .get_envs()
            .find(|(k, _)| *k == std::ffi::OsStr::new("PATH"));
        assert!(env.is_some(), "command must set PATH env var");
        let (_, val) = env.unwrap();
        assert_eq!(val, Some(std::ffi::OsStr::new(resolved_path())));
    }
}
