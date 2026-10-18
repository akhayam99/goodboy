use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(windows), allow(dead_code))]
pub enum ShellKind {
    Posix,
    PowerShell,
    WindowsPowerShell,
    Cmd,
    GitBash,
    Wsl,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellProfile {
    pub id: String,
    pub kind: ShellKind,
    pub label: String,
    pub program: PathBuf,
    pub distro: Option<String>,
    pub is_default: bool,
}

impl ShellProfile {
    pub fn interactive_args(&self) -> Vec<String> {
        match self.kind {
            ShellKind::Posix | ShellKind::GitBash => vec!["-l".into(), "-i".into()],
            ShellKind::PowerShell | ShellKind::WindowsPowerShell => vec![
                "-NoLogo".into(),
                "-NoExit".into(),
                "-Command".into(),
                POWERSHELL_UTF8.into(),
            ],
            ShellKind::Cmd => vec!["/K".into(), CMD_UTF8.into()],
            ShellKind::Wsl => self
                .distro
                .iter()
                .flat_map(|distro| ["-d".to_string(), distro.clone()])
                .collect(),
        }
    }

    pub fn startup_env(&self) -> Vec<(&'static str, &'static str)> {
        match self.kind {
            ShellKind::GitBash => vec![("PROMPT_COMMAND", GIT_BASH_UTF8)],
            ShellKind::Posix
            | ShellKind::PowerShell
            | ShellKind::WindowsPowerShell
            | ShellKind::Cmd
            | ShellKind::Wsl => Vec::new(),
        }
    }

    pub fn exports_shell_variable(&self) -> bool {
        matches!(self.kind, ShellKind::Posix | ShellKind::GitBash)
    }
}

pub const POSIX_FALLBACK: &str = "/bin/sh";

const POWERSHELL_UTF8: &str =
    "[Console]::InputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)";
const CMD_UTF8: &str = "chcp 65001>nul";
const GIT_BASH_UTF8: &str = "chcp.com 65001 >/dev/null; unset PROMPT_COMMAND";

#[cfg(target_os = "macos")]
pub fn posix_candidates() -> &'static [&'static str] {
    &["/bin/zsh", "/bin/bash", "/bin/sh"]
}

#[cfg(target_os = "linux")]
pub fn posix_candidates() -> &'static [&'static str] {
    &["/bin/bash", "/bin/zsh", "/bin/sh"]
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn posix_candidates() -> &'static [&'static str] {
    &[]
}

fn posix_profile(program: &str, is_default: bool) -> ShellProfile {
    let label = Path::new(program)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| program.to_string());
    ShellProfile {
        id: program.to_string(),
        kind: ShellKind::Posix,
        label,
        program: PathBuf::from(program),
        distro: None,
        is_default,
    }
}

pub struct PosixSources {
    pub login_shell: Option<String>,
    pub listed: Vec<String>,
}

pub fn posix_profiles(sources: &PosixSources, exists: &dyn Fn(&Path) -> bool) -> Vec<ShellProfile> {
    let mut programs: Vec<String> = Vec::new();
    let mut push = |program: &str| {
        let program = program.trim();
        if program.is_empty() || !program.starts_with('/') || !exists(Path::new(program)) {
            return;
        }
        if programs.iter().any(|known| known == program) {
            return;
        }
        programs.push(program.to_string());
    };
    if let Some(login) = sources.login_shell.as_deref() {
        push(login);
    }
    for candidate in posix_candidates() {
        push(candidate);
    }
    for listed in &sources.listed {
        push(listed);
    }
    if programs.is_empty() {
        programs.push(POSIX_FALLBACK.to_string());
    }
    programs
        .iter()
        .enumerate()
        .map(|(index, program)| posix_profile(program, index == 0))
        .collect()
}

pub fn parse_etc_shells(text: &str) -> Vec<String> {
    text.lines()
        .map(str::trim)
        .filter(|line| line.starts_with('/'))
        .map(str::to_string)
        .collect()
}

#[cfg(any(windows, test))]
pub struct WindowsSources {
    pub program_files: Vec<PathBuf>,
    pub system_root: PathBuf,
    pub com_spec: Option<PathBuf>,
    pub pwsh_on_path: Option<PathBuf>,
    pub git_install_dirs: Vec<PathBuf>,
    pub wsl_distros: Vec<String>,
}

#[cfg(any(windows, test))]
fn windows_profile(id: &str, kind: ShellKind, label: &str, program: PathBuf) -> ShellProfile {
    ShellProfile {
        id: id.to_string(),
        kind,
        label: label.to_string(),
        program,
        distro: None,
        is_default: false,
    }
}

#[cfg(any(windows, test))]
fn first_existing(candidates: Vec<PathBuf>, exists: &dyn Fn(&Path) -> bool) -> Option<PathBuf> {
    candidates.into_iter().find(|candidate| exists(candidate))
}

#[cfg(any(windows, test))]
pub fn windows_profiles(
    sources: &WindowsSources,
    exists: &dyn Fn(&Path) -> bool,
) -> Vec<ShellProfile> {
    let system32 = sources.system_root.join("System32");
    let mut profiles = Vec::new();

    let installed_pwsh: Vec<PathBuf> = sources
        .program_files
        .iter()
        .map(|dir| dir.join("PowerShell").join("7").join("pwsh.exe"))
        .chain(sources.pwsh_on_path.clone())
        .collect();
    if let Some(program) = first_existing(installed_pwsh, exists) {
        profiles.push(windows_profile(
            "pwsh",
            ShellKind::PowerShell,
            "PowerShell 7",
            program,
        ));
    }

    let inbox = system32
        .join("WindowsPowerShell")
        .join("v1.0")
        .join("powershell.exe");
    if exists(&inbox) {
        profiles.push(windows_profile(
            "powershell",
            ShellKind::WindowsPowerShell,
            "Windows PowerShell",
            inbox,
        ));
    }

    let cmd_candidates: Vec<PathBuf> = sources
        .com_spec
        .clone()
        .into_iter()
        .chain([system32.join("cmd.exe")])
        .collect();
    if let Some(program) = first_existing(cmd_candidates, exists) {
        profiles.push(windows_profile(
            "cmd",
            ShellKind::Cmd,
            "Command Prompt",
            program,
        ));
    }

    let git_bash: Vec<PathBuf> = sources
        .git_install_dirs
        .iter()
        .map(|dir| dir.join("bin").join("bash.exe"))
        .collect();
    if let Some(program) = first_existing(git_bash, exists) {
        profiles.push(windows_profile(
            "gitbash",
            ShellKind::GitBash,
            "Git Bash",
            program,
        ));
    }

    let wsl = system32.join("wsl.exe");
    if exists(&wsl) {
        for distro in &sources.wsl_distros {
            if distro.trim().is_empty() || distro.starts_with("docker-desktop") {
                continue;
            }
            profiles.push(ShellProfile {
                id: format!("wsl:{distro}"),
                kind: ShellKind::Wsl,
                label: format!("WSL: {distro}"),
                program: wsl.clone(),
                distro: Some(distro.clone()),
                is_default: false,
            });
        }
    }

    if let Some(first) = profiles.first_mut() {
        first.is_default = true;
    }
    profiles
}

pub fn launch_order(profiles: &[ShellProfile], preferred: Option<&str>) -> Vec<ShellProfile> {
    let mut order: Vec<ShellProfile> = Vec::new();
    if let Some(chosen) = preferred.and_then(|id| profiles.iter().find(|p| p.id == id)) {
        order.push(chosen.clone());
    }
    for profile in profiles {
        let is_fallback = matches!(
            profile.kind,
            ShellKind::Posix
                | ShellKind::PowerShell
                | ShellKind::WindowsPowerShell
                | ShellKind::Cmd
        );
        if is_fallback && !order.iter().any(|known| known.id == profile.id) {
            order.push(profile.clone());
        }
    }
    order
}

#[cfg(windows)]
fn gather() -> Vec<ShellProfile> {
    use super::paths;
    use super::windows::registry::{self, Root};

    let program_files: Vec<PathBuf> = ["ProgramW6432", "ProgramFiles"]
        .iter()
        .filter_map(|name| paths::env_dir(name))
        .collect();
    let system_root = paths::env_dir("SystemRoot").unwrap_or_else(|| PathBuf::from("C:\\Windows"));
    let extensions = paths::program_extensions();
    let path_list = crate::path_env::resolved_path();
    let pwsh_on_path = paths::find_program_in("pwsh", path_list, extensions.as_deref());

    let mut git_install_dirs: Vec<PathBuf> = [Root::LocalMachine, Root::CurrentUser]
        .into_iter()
        .filter_map(|root| registry::read_string(root, "SOFTWARE\\GitForWindows", "InstallPath"))
        .map(PathBuf::from)
        .collect();
    if let Some(git) = paths::find_program_in("git", path_list, extensions.as_deref()) {
        if let Some(root) = git.parent().and_then(Path::parent) {
            git_install_dirs.push(root.to_path_buf());
        }
    }
    git_install_dirs.extend(program_files.iter().map(|dir| dir.join("Git")));
    if let Some(local) = paths::env_dir("LOCALAPPDATA") {
        git_install_dirs.push(local.join("Programs").join("Git"));
    }

    let lxss = "Software\\Microsoft\\Windows\\CurrentVersion\\Lxss";
    let wsl_distros: Vec<String> = registry::subkeys(Root::CurrentUser, lxss)
        .into_iter()
        .filter_map(|id| {
            registry::read_string(
                Root::CurrentUser,
                &format!("{lxss}\\{id}"),
                "DistributionName",
            )
        })
        .collect();

    let sources = WindowsSources {
        program_files,
        system_root,
        com_spec: paths::env_dir("ComSpec"),
        pwsh_on_path,
        git_install_dirs,
        wsl_distros,
    };
    windows_profiles(&sources, &|path| path.is_file())
}

#[cfg(not(windows))]
fn gather() -> Vec<ShellProfile> {
    let sources = PosixSources {
        login_shell: std::env::var("SHELL").ok(),
        listed: std::fs::read_to_string("/etc/shells")
            .map(|text| parse_etc_shells(&text))
            .unwrap_or_default(),
    };
    posix_profiles(&sources, &|path| path.exists())
}

static DISCOVERED: Mutex<Option<Vec<ShellProfile>>> = Mutex::new(None);

pub fn discover() -> Vec<ShellProfile> {
    let mut guard = DISCOVERED
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(found) = guard.as_ref() {
        return found.clone();
    }
    let found = gather();
    *guard = Some(found.clone());
    found
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn present(paths: &[&str]) -> impl Fn(&Path) -> bool {
        let set: HashSet<PathBuf> = paths.iter().map(PathBuf::from).collect();
        move |path: &Path| set.contains(path)
    }

    fn windows_sources() -> WindowsSources {
        WindowsSources {
            program_files: vec![PathBuf::from("C:/Program Files")],
            system_root: PathBuf::from("C:/Windows"),
            com_spec: Some(PathBuf::from("C:/Windows/System32/cmd.exe")),
            pwsh_on_path: None,
            git_install_dirs: vec![PathBuf::from("C:/Program Files/Git")],
            wsl_distros: vec!["Ubuntu".into(), "docker-desktop-data".into()],
        }
    }

    fn system32(file: &str) -> String {
        Path::new("C:/Windows")
            .join("System32")
            .join(file)
            .to_string_lossy()
            .into_owned()
    }

    fn joined(parts: &[&str]) -> String {
        let mut path = PathBuf::from(parts[0]);
        for part in &parts[1..] {
            path = path.join(part);
        }
        path.to_string_lossy().into_owned()
    }

    #[test]
    fn a_full_windows_machine_lists_every_shell_with_pwsh_as_default() {
        let pwsh = joined(&["C:/Program Files", "PowerShell", "7", "pwsh.exe"]);
        let inbox = joined(&[
            "C:/Windows",
            "System32",
            "WindowsPowerShell",
            "v1.0",
            "powershell.exe",
        ]);
        let bash = joined(&["C:/Program Files/Git", "bin", "bash.exe"]);
        let exists = present(&[
            &pwsh,
            &inbox,
            "C:/Windows/System32/cmd.exe",
            &bash,
            &system32("wsl.exe"),
        ]);

        let profiles = windows_profiles(&windows_sources(), &exists);

        let ids: Vec<&str> = profiles.iter().map(|p| p.id.as_str()).collect();
        assert_eq!(ids, ["pwsh", "powershell", "cmd", "gitbash", "wsl:Ubuntu"]);
        assert!(profiles[0].is_default);
        assert!(profiles[1..].iter().all(|p| !p.is_default));
    }

    #[test]
    fn without_pwsh_the_inbox_powershell_is_the_default() {
        let inbox = joined(&[
            "C:/Windows",
            "System32",
            "WindowsPowerShell",
            "v1.0",
            "powershell.exe",
        ]);
        let exists = present(&[&inbox, "C:/Windows/System32/cmd.exe"]);

        let profiles = windows_profiles(&windows_sources(), &exists);

        assert_eq!(profiles[0].kind, ShellKind::WindowsPowerShell);
        assert!(profiles[0].is_default);
    }

    #[test]
    fn pwsh_found_only_on_the_path_is_still_listed() {
        let mut sources = windows_sources();
        sources.pwsh_on_path = Some(PathBuf::from("D:/tools/pwsh.exe"));
        let exists = present(&["D:/tools/pwsh.exe"]);

        let profiles = windows_profiles(&sources, &exists);

        assert_eq!(profiles[0].program, PathBuf::from("D:/tools/pwsh.exe"));
    }

    #[test]
    fn the_wsl_entry_passes_its_distribution() {
        let exists = present(&[&system32("wsl.exe")]);

        let profiles = windows_profiles(&windows_sources(), &exists);

        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].interactive_args(), ["-d", "Ubuntu"]);
    }

    #[test]
    fn each_kind_gets_arguments_it_understands() {
        let profile = |kind| ShellProfile {
            id: "x".into(),
            kind,
            label: "x".into(),
            program: PathBuf::from("x"),
            distro: None,
            is_default: false,
        };
        assert_eq!(profile(ShellKind::Posix).interactive_args(), ["-l", "-i"]);
        assert_eq!(profile(ShellKind::GitBash).interactive_args(), ["-l", "-i"]);
        assert_eq!(
            profile(ShellKind::PowerShell).interactive_args()[..3],
            ["-NoLogo", "-NoExit", "-Command"]
        );
        assert_eq!(
            profile(ShellKind::Cmd).interactive_args(),
            ["/K", "chcp 65001>nul"]
        );
    }

    #[test]
    fn every_windows_shell_starts_in_utf8() {
        let profile = |kind| ShellProfile {
            id: "x".into(),
            kind,
            label: "x".into(),
            program: PathBuf::from("x"),
            distro: None,
            is_default: false,
        };
        let powershell = profile(ShellKind::WindowsPowerShell).interactive_args();
        assert!(powershell[3].contains("[Text.UTF8Encoding]::new($false)"));
        assert!(!powershell[3].contains(' '));
        let git_bash = profile(ShellKind::GitBash).startup_env();
        assert_eq!(git_bash[0].0, "PROMPT_COMMAND");
        assert!(git_bash[0].1.starts_with("chcp.com 65001"));
        assert!(git_bash[0].1.ends_with("unset PROMPT_COMMAND"));
        assert!(profile(ShellKind::Posix).startup_env().is_empty());
    }

    #[test]
    fn the_chosen_shell_goes_first_and_the_defaults_follow() {
        let pwsh = joined(&["C:/Program Files", "PowerShell", "7", "pwsh.exe"]);
        let bash = joined(&["C:/Program Files/Git", "bin", "bash.exe"]);
        let exists = present(&[&pwsh, "C:/Windows/System32/cmd.exe", &bash]);
        let profiles = windows_profiles(&windows_sources(), &exists);

        let order = launch_order(&profiles, Some("gitbash"));

        let ids: Vec<&str> = order.iter().map(|p| p.id.as_str()).collect();
        assert_eq!(ids, ["gitbash", "pwsh", "cmd"]);
    }

    #[test]
    fn an_unknown_choice_falls_back_to_the_defaults() {
        let exists = present(&["C:/Windows/System32/cmd.exe"]);
        let profiles = windows_profiles(&windows_sources(), &exists);

        let order = launch_order(&profiles, Some("pwsh"));

        assert_eq!(order.len(), 1);
        assert_eq!(order[0].id, "cmd");
    }

    #[test]
    fn the_login_shell_comes_first_on_posix() {
        let sources = PosixSources {
            login_shell: Some("/opt/homebrew/bin/fish".into()),
            listed: vec!["/bin/bash".into(), "/usr/bin/zsh".into()],
        };
        let exists = present(&["/opt/homebrew/bin/fish", "/bin/bash", "/bin/sh"]);

        let profiles = posix_profiles(&sources, &exists);

        assert_eq!(profiles[0].id, "/opt/homebrew/bin/fish");
        assert!(profiles[0].is_default);
        assert!(profiles.iter().all(|p| p.id != "/usr/bin/zsh"));
    }

    #[test]
    fn posix_falls_back_to_bin_sh_when_nothing_is_found() {
        let sources = PosixSources {
            login_shell: None,
            listed: Vec::new(),
        };

        let profiles = posix_profiles(&sources, &present(&[]));

        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].id, POSIX_FALLBACK);
    }

    #[test]
    fn etc_shells_keeps_only_absolute_entries() {
        let text = "# comment line\n/bin/sh\n\n  /usr/bin/fish \nnot-a-path\n";
        assert_eq!(parse_etc_shells(text), ["/bin/sh", "/usr/bin/fish"]);
    }

    #[test]
    fn discovery_finds_at_least_one_shell_that_exists() {
        let profiles = discover();
        assert!(!profiles.is_empty());
        assert!(profiles[0].is_default);
        assert!(profiles[0].program.exists(), "{:?}", profiles[0].program);
    }
}
