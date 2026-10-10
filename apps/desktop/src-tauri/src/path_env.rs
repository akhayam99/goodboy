use std::collections::HashSet;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::proc::probe;

struct Slot<T: 'static> {
    value: Option<&'static T>,
    failures: u8,
}

static RESOLVED_PATH: Mutex<Slot<String>> = Mutex::new(Slot {
    value: None,
    failures: 0,
});
static RESOLVED_ENV: Mutex<Slot<Vec<(String, String)>>> = Mutex::new(Slot {
    value: None,
    failures: 0,
});

const PROBE_TIMEOUT: Duration = Duration::from_secs(3);
const MAX_PROBE_FAILURES: u8 = 3;

fn resolve<T: 'static>(slot: &Mutex<Slot<T>>, compute: impl FnOnce() -> (T, bool)) -> &'static T {
    let mut guard = slot.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(value) = guard.value {
        return value;
    }
    let (value, is_complete) = compute();
    let leaked: &'static T = Box::leak(Box::new(value));
    if is_complete {
        guard.value = Some(leaked);
        return leaked;
    }
    guard.failures += 1;
    if guard.failures >= MAX_PROBE_FAILURES {
        guard.value = Some(leaked);
    }
    leaked
}

/// PATH inherited from the user's login shell, merged with the process's own
/// PATH and common install locations, deduplicated, cached after first call.
///
/// macOS GUI apps launched from Finder/Dock receive only the minimal posix
/// PATH (`/usr/bin:/bin:/usr/sbin:/sbin`), which excludes `/opt/homebrew/bin`
/// and other typical install dirs. Without this resolution, `Command::new`
/// fails with ENOENT for `claude`, `cursor-agent`, `codex`, `gh`,
/// brew-installed `git`, user editors, etc.
pub fn resolved_path() -> &'static str {
    resolve(&RESOLVED_PATH, compute_path).as_str()
}

/// `Command` pre-wired with the resolved PATH. Drop-in replacement for
/// `Command::new` whenever the target binary may live outside the minimal
/// posix path set.
pub fn command(binary: &str) -> Command {
    let mut cmd = Command::new(binary);
    cmd.env("PATH", resolved_path());
    cmd
}

pub fn which(binary: &str) -> Option<String> {
    if binary.contains('/') {
        return Some(binary.to_string());
    }
    std::env::split_paths(resolved_path())
        .map(|dir| dir.join(binary))
        .find(|candidate| is_executable_file(candidate))
        .map(|found| found.to_string_lossy().into_owned())
}

#[cfg(unix)]
fn is_executable_file(path: &std::path::Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    std::fs::metadata(path)
        .map(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}

#[cfg(not(unix))]
fn is_executable_file(path: &std::path::Path) -> bool {
    path.is_file()
}

pub fn resolved_env() -> &'static [(String, String)] {
    resolve(&RESOLVED_ENV, compute_env).as_slice()
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

fn compute_path() -> (String, bool) {
    let inherited = std::env::var("PATH").unwrap_or_default();
    let (shell, npm_bin) = probe_login_shell();
    let is_complete = shell.is_some();
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
    (parts.join(":"), is_complete)
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

fn compute_env() -> (Vec<(String, String)>, bool) {
    let raw = probe_login_shell_env();
    let is_complete = raw.is_some();
    (parse_env(&raw.unwrap_or_default()), is_complete)
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
    let mut command = Command::new(bin);
    command.args(args);
    let started = Instant::now();
    let result = probe::run_in_session(command, Instant::now() + PROBE_TIMEOUT);
    let millis = started.elapsed().as_millis();
    let Ok(out) = result else {
        log::info!("[path] login shell {bin} failed to start after {millis}ms");
        return None;
    };
    if out.timed_out {
        log::info!("[path] login shell {bin} timed out after {millis}ms");
        return None;
    }
    if out.code != Some(0) {
        log::info!(
            "[path] login shell {bin} exited {:?} after {millis}ms",
            out.code
        );
        return None;
    }
    log::info!("[path] login shell {bin} answered in {millis}ms");
    Some(out.stdout)
}

fn common_install_paths() -> String {
    common_install_paths_for(&std::env::var("HOME").unwrap_or_default())
}

fn node_version_key(name: &str) -> Vec<u64> {
    name.trim_start_matches('v')
        .split('.')
        .map(|part| part.parse::<u64>().unwrap_or(0))
        .collect()
}

fn nvm_bin_dirs(home: &str) -> Vec<String> {
    let root = std::path::Path::new(home).join(".nvm/versions/node");
    let Ok(entries) = std::fs::read_dir(&root) else {
        return Vec::new();
    };
    let mut versions: Vec<String> = entries
        .flatten()
        .filter(|entry| entry.path().join("bin").is_dir())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();
    versions.sort_by_key(|name| std::cmp::Reverse(node_version_key(name)));
    versions
        .into_iter()
        .map(|name| root.join(name).join("bin").to_string_lossy().into_owned())
        .collect()
}

fn common_install_paths_for(home: &str) -> String {
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
            "/.asdf/shims",
            "/.local/share/mise/shims",
        ] {
            parts.push(format!("{}{}", home, sub));
        }
        parts.extend(nvm_bin_dirs(home));
    }
    parts.join(":")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn which_finds_the_first_executable_on_the_resolved_path() {
        let found = which("sh").expect("sh is on every unix PATH");
        assert!(found.ends_with("/sh"), "got: {}", found);
        assert_eq!(
            which("/opt/custom/claude").as_deref(),
            Some("/opt/custom/claude")
        );
        assert_eq!(which("goodboy-no-such-binary"), None);
    }

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
        let (merged, _) = compute_path();
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

    #[cfg(unix)]
    fn temp_home(tag: &str) -> std::path::PathBuf {
        let home =
            std::env::temp_dir().join(format!("goodboy-path-env-{}-{}", std::process::id(), tag));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(&home).expect("create the temp home");
        home
    }

    #[cfg(unix)]
    fn install_binary(dir: &std::path::Path, name: &str) {
        use std::os::unix::fs::PermissionsExt;
        std::fs::create_dir_all(dir).expect("create the bin dir");
        let file = dir.join(name);
        std::fs::write(&file, "#!/bin/sh\n").expect("write the binary");
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o755))
            .expect("make it executable");
    }

    #[cfg(unix)]
    fn finds_in(paths: &str, binary: &str) -> Option<String> {
        std::env::split_paths(paths)
            .map(|dir| dir.join(binary))
            .find(|candidate| is_executable_file(candidate))
            .map(|found| found.to_string_lossy().into_owned())
    }

    #[cfg(unix)]
    #[test]
    fn the_static_list_finds_a_binary_installed_under_nvm() {
        let home = temp_home("nvm");
        install_binary(
            &home.join(".nvm/versions/node/v22.0.0/bin"),
            "goodboy-nvm-cli",
        );

        let paths = common_install_paths_for(&home.to_string_lossy());

        let found =
            finds_in(&paths, "goodboy-nvm-cli").expect("the binary must be on the static list");
        assert!(found.contains(".nvm/versions/node/v22.0.0/bin"));
        let _ = std::fs::remove_dir_all(&home);
    }

    #[cfg(unix)]
    #[test]
    fn the_newest_nvm_node_comes_first() {
        let home = temp_home("nvm-order");
        for version in ["v20.9.0", "v22.0.0", "v9.11.2", "v22.10.1"] {
            install_binary(
                &home.join(".nvm/versions/node").join(version).join("bin"),
                "goodboy-nvm-cli",
            );
        }

        let paths = common_install_paths_for(&home.to_string_lossy());

        let found =
            finds_in(&paths, "goodboy-nvm-cli").expect("the binary must be on the static list");
        assert!(found.contains("v22.10.1"), "got: {found}");
        let _ = std::fs::remove_dir_all(&home);
    }

    #[cfg(unix)]
    #[test]
    fn the_static_list_carries_the_asdf_and_mise_shims() {
        let home = temp_home("shims");
        install_binary(&home.join(".asdf/shims"), "goodboy-shim-a");
        install_binary(&home.join(".local/share/mise/shims"), "goodboy-shim-b");

        let paths = common_install_paths_for(&home.to_string_lossy());

        assert!(finds_in(&paths, "goodboy-shim-a").is_some());
        assert!(finds_in(&paths, "goodboy-shim-b").is_some());
        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn a_failed_probe_is_retried_and_then_cached_after_three_tries() {
        let slot: Mutex<Slot<u32>> = Mutex::new(Slot {
            value: None,
            failures: 0,
        });
        let mut calls = 0;

        for _ in 0..6 {
            resolve(&slot, || {
                calls += 1;
                (calls, false)
            });
        }

        assert_eq!(calls, 3);
    }

    #[test]
    fn a_successful_probe_is_cached_at_once() {
        let slot: Mutex<Slot<u32>> = Mutex::new(Slot {
            value: None,
            failures: 0,
        });
        let mut calls = 0;

        for _ in 0..4 {
            resolve(&slot, || {
                calls += 1;
                (calls, true)
            });
        }

        assert_eq!(calls, 1);
    }

    #[test]
    fn a_failed_probe_value_is_replaced_by_the_next_successful_one() {
        let slot: Mutex<Slot<u32>> = Mutex::new(Slot {
            value: None,
            failures: 0,
        });

        let first = *resolve(&slot, || (1, false));
        let second = *resolve(&slot, || (2, true));
        let third = *resolve(&slot, || (3, true));

        assert_eq!((first, second, third), (1, 2, 2));
    }
}
