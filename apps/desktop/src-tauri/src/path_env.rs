use std::collections::HashSet;
use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

static RESOLVED_PATH: OnceLock<String> = OnceLock::new();

const PROBE_TIMEOUT: Duration = Duration::from_secs(3);
const POLL_INTERVAL: Duration = Duration::from_millis(50);
const SEP: char = if cfg!(windows) { ';' } else { ':' };

// CREATE_NO_WINDOW: a GUI (windows-subsystem) process spawning a console child
// allocates a console window for it, which flashes on screen. This suppresses
// it. Applies to both .spawn() and .output().
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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
    #[cfg(windows)]
    let mut cmd = match resolve_program(binary) {
        Some(full) => Command::new(full),
        None => Command::new(binary),
    };
    #[cfg(not(windows))]
    let mut cmd = Command::new(binary);
    cmd.env("PATH", resolved_path());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

// Command::new on Windows only finds <name>.exe by bare name; it does NOT find
// the .cmd/.bat shims npm creates for global CLIs (claude.cmd, codex.cmd, ...),
// so spawning "claude" directly fails with "program not found". Resolve the
// bare name against the merged PATH using PATHEXT and hand Command a full path
// it can launch. A resolved .cmd/.bat path is run by Rust via cmd with proper
// argument escaping. Names that are already qualified (a path or an explicit
// extension) are left untouched.
#[cfg(windows)]
fn resolve_program(binary: &str) -> Option<std::path::PathBuf> {
    use std::path::Path;
    let raw = Path::new(binary);
    if raw.components().count() > 1 || raw.extension().is_some() {
        return None;
    }
    let exts: Vec<String> = std::env::var("PATHEXT")
        .unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string())
        .split(';')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    for dir in resolved_path().split(SEP) {
        let dir = dir.trim();
        if dir.is_empty() {
            continue;
        }
        for ext in &exts {
            let candidate = Path::new(dir).join(format!("{}{}", binary, ext));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn compute_path() -> String {
    let inherited = std::env::var("PATH").unwrap_or_default();
    let shell = probe_login_shell_path().unwrap_or_default();
    let common = common_install_paths();

    let mut parts: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for source in [shell.as_str(), inherited.as_str(), common.as_str()] {
        for segment in source.split(SEP) {
            let segment = segment.trim();
            if !segment.is_empty() && seen.insert(segment.to_string()) {
                parts.push(segment.to_string());
            }
        }
    }
    parts.join(&SEP.to_string())
}

#[cfg(target_os = "macos")]
fn shell_candidates() -> &'static [(&'static str, &'static [&'static str])] {
    &[
        ("/bin/zsh", &["-ilc", "printf %s \"$PATH\""]),
        ("/bin/bash", &["-ilc", "printf %s \"$PATH\""]),
        ("/bin/sh", &["-lc", "printf %s \"$PATH\""]),
    ]
}

#[cfg(target_os = "linux")]
fn shell_candidates() -> &'static [(&'static str, &'static [&'static str])] {
    &[
        ("/bin/bash", &["-ilc", "printf %s \"$PATH\""]),
        ("/bin/zsh", &["-ilc", "printf %s \"$PATH\""]),
        ("/bin/sh", &["-lc", "printf %s \"$PATH\""]),
    ]
}

#[cfg(target_os = "windows")]
fn shell_candidates() -> &'static [(&'static str, &'static [&'static str])] {
    // Windows GUI processes already inherit the full user PATH, so falling back
    // to the inherited PATH is correct and no login-shell probe is needed.
    &[]
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn shell_candidates() -> &'static [(&'static str, &'static [&'static str])] {
    &[]
}

fn probe_login_shell_path() -> Option<String> {
    for (sh, args) in shell_candidates() {
        if !std::path::Path::new(sh).exists() {
            continue;
        }
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
    let mut builder = Command::new(bin);
    builder
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .stdin(Stdio::null());
    #[cfg(windows)]
    builder.creation_flags(CREATE_NO_WINDOW);
    let mut child = builder.spawn().ok()?;

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
    let home = dirs::home_dir().and_then(|p| p.to_str().map(str::to_string));
    let mut parts: Vec<String> = Vec::new();

    #[cfg(not(windows))]
    {
        parts.extend(
            [
                "/opt/homebrew/bin",
                "/opt/homebrew/sbin",
                "/usr/local/bin",
                "/usr/local/sbin",
                "/usr/bin",
                "/bin",
                "/usr/sbin",
                "/sbin",
            ]
            .map(String::from),
        );
        if let Some(home) = home.as_deref() {
            for sub in &[
                "/.bun/bin",
                "/.cargo/bin",
                "/.local/bin",
                "/.deno/bin",
                "/.volta/bin",
            ] {
                parts.push(format!("{}{}", home, sub));
            }
        }
    }

    #[cfg(windows)]
    {
        // Discover npm's real global prefix and add it: on Windows the
        // `npm install -g` shims (claude.cmd, codex.cmd, gemini.cmd) live
        // directly there. Probing covers non-default prefixes (nvm-windows,
        // volta, scoop, or a custom `npm config set prefix`) that data_dir()
        // would miss. data_dir()/npm stays as the default fallback.
        if let Some(prefix) = run_with_timeout("cmd", &["/C", "npm", "config", "get", "prefix"]) {
            let prefix = prefix.trim();
            if !prefix.is_empty() {
                parts.push(prefix.to_string());
            }
        }
        if let Some(npm) = dirs::data_dir().map(|p| p.join("npm")) {
            if let Some(npm) = npm.to_str() {
                parts.push(npm.to_string());
            }
        }
        if let Some(home) = home {
            parts.push(home);
        }
    }

    parts.join(&SEP.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolved_path_is_non_empty_and_contains_bin() {
        let p = resolved_path();
        assert!(!p.is_empty(), "resolved PATH must not be empty");
        #[cfg(not(windows))]
        assert!(
            p.split(SEP).any(|seg| seg == "/bin"),
            "resolved PATH should include /bin, got: {}",
            p
        );
    }

    #[test]
    fn command_inherits_resolved_path() {
        let cmd = command("true");
        let env = cmd.get_envs().find(|(k, _)| *k == std::ffi::OsStr::new("PATH"));
        assert!(env.is_some(), "command must set PATH env var");
        let (_, val) = env.unwrap();
        assert!(val.is_some());
        assert_eq!(val.unwrap(), std::ffi::OsStr::new(resolved_path()));
    }

    #[test]
    fn compute_path_dedups_segments() {
        let merged = compute_path();
        let segments: Vec<&str> = merged.split(SEP).collect();
        let mut unique = HashSet::new();
        for s in &segments {
            assert!(unique.insert(*s), "duplicate segment in resolved PATH: {}", s);
        }
    }
}
