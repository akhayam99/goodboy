use crate::util::MessageError;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

pub const SETTING_TERMINAL_APP: &str = "terminal.app";
const DEFAULT_TERMINAL: &str = "terminal";

struct KnownTerminal {
    id: &'static str,
    label: &'static str,
    mac_app: &'static str,
    can_run_command: bool,
}

const KNOWN_TERMINALS: &[KnownTerminal] = &[
    KnownTerminal {
        id: "terminal",
        label: "Terminal.app",
        mac_app: "Terminal",
        can_run_command: true,
    },
    KnownTerminal {
        id: "iterm",
        label: "iTerm",
        mac_app: "iTerm",
        can_run_command: true,
    },
    KnownTerminal {
        id: "warp",
        label: "Warp",
        mac_app: "Warp",
        can_run_command: false,
    },
    KnownTerminal {
        id: "ghostty",
        label: "Ghostty",
        mac_app: "Ghostty",
        can_run_command: false,
    },
];

const MAC_APP_DIRS: &[&str] = &[
    "/Applications",
    "/Applications/Utilities",
    "/System/Applications",
    "/System/Applications/Utilities",
    "/System/Cryptexes/App/System/Applications",
];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetectedTerminal {
    pub id: String,
    pub label: String,
    pub can_run_command: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Launch {
    program: String,
    args: Vec<String>,
}

fn terminal_by_id(id: &str) -> Option<&'static KnownTerminal> {
    KNOWN_TERMINALS.iter().find(|known| known.id == id)
}

fn default_terminal() -> &'static KnownTerminal {
    &KNOWN_TERMINALS[0]
}

fn is_installed(terminal: &KnownTerminal) -> bool {
    if !cfg!(target_os = "macos") {
        return terminal.id == DEFAULT_TERMINAL;
    }
    let bundle = format!("{}.app", terminal.mac_app);
    let home_apps = std::env::var_os("HOME").map(|home| PathBuf::from(home).join("Applications"));
    MAC_APP_DIRS
        .iter()
        .map(PathBuf::from)
        .chain(home_apps)
        .any(|dir| dir.join(&bundle).exists())
}

fn detected_terminals() -> Vec<DetectedTerminal> {
    KNOWN_TERMINALS
        .iter()
        .filter(|terminal| is_installed(terminal))
        .map(|terminal| DetectedTerminal {
            id: terminal.id.to_string(),
            label: terminal.label.to_string(),
            can_run_command: terminal.can_run_command,
        })
        .collect()
}

#[tauri::command(async)]
pub fn detect_terminals() -> Vec<DetectedTerminal> {
    detected_terminals()
}

fn chosen_terminal(
    requested: Option<&str>,
    saved: Option<&str>,
) -> Result<&'static KnownTerminal, MessageError> {
    chosen_terminal_among(requested, saved, is_installed)
}

fn chosen_terminal_among(
    requested: Option<&str>,
    saved: Option<&str>,
    installed: impl Fn(&KnownTerminal) -> bool,
) -> Result<&'static KnownTerminal, MessageError> {
    if let Some(id) = requested {
        let terminal = terminal_by_id(id.trim())
            .ok_or_else(|| MessageError::Refused(format!("unknown terminal app '{id}'")))?;
        if !installed(terminal) {
            return Err(MessageError::Refused(format!(
                "{} is not installed",
                terminal.label
            )));
        }
        return Ok(terminal);
    }
    let chosen = saved
        .and_then(|id| terminal_by_id(id.trim()))
        .filter(|terminal| installed(terminal));
    Ok(chosen.unwrap_or_else(default_terminal))
}

fn folder_launch(terminal: &KnownTerminal, folder: &Path) -> Launch {
    Launch {
        program: "open".to_string(),
        args: vec![
            "-a".to_string(),
            terminal.mac_app.to_string(),
            folder.to_string_lossy().to_string(),
        ],
    }
}

fn applescript_text(command: &str) -> String {
    command.replace('\\', "\\\\").replace('"', "\\\"")
}

fn command_script(terminal: &KnownTerminal, command: &str) -> String {
    let escaped = applescript_text(command);
    if terminal.id == "iterm" {
        return format!(
            "tell application \"iTerm\"\n  activate\n  set openedWindow to (create window with default profile)\n  tell current session of openedWindow to write text \"{escaped}\"\nend tell"
        );
    }
    format!("tell application \"Terminal\"\n  do script \"{escaped}\"\n  activate\nend tell")
}

fn start(mut command: Command) -> Result<(), String> {
    let child = command.spawn().map_err(|error| error.to_string())?;
    crate::proc::detach::detach(child);
    Ok(())
}

fn command_in_terminal(terminal: &'static KnownTerminal, command: &str) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        let usable = Some(terminal)
            .filter(|candidate| candidate.can_run_command)
            .unwrap_or_else(default_terminal);
        let mut osascript = Command::new("osascript");
        osascript.args(["-e", &command_script(usable, command)]);
        return start(osascript);
    }
    if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(["/c", "start", "cmd", "/k", command]);
        return start(cmd);
    }
    let paused = format!("{command}; read -p 'press enter to close'");
    let candidates: [(&str, &[&str]); 3] = [
        ("gnome-terminal", &["--", "bash", "-c"]),
        ("konsole", &["-e", "bash", "-c"]),
        ("xterm", &["-e", "bash", "-c"]),
    ];
    for (program, base_args) in candidates {
        let mut attempt = Command::new(program);
        attempt.args(base_args).arg(&paused);
        if start(attempt).is_ok() {
            return Ok(());
        }
    }
    Err("no supported terminal emulator found (tried gnome-terminal, konsole, xterm)".to_string())
}

fn folder_in_terminal(terminal: &KnownTerminal, folder: &Path) -> Result<(), String> {
    if cfg!(target_os = "macos") {
        let launch = folder_launch(terminal, folder);
        let mut open = Command::new(&launch.program);
        open.args(&launch.args);
        return start(open);
    }
    if cfg!(target_os = "windows") {
        let mut cmd = Command::new("cmd");
        cmd.args(["/c", "start", "cmd", "/k"]).current_dir(folder);
        return start(cmd);
    }
    let dir = folder.to_string_lossy().to_string();
    let candidates: [(&str, Vec<String>); 3] = [
        ("gnome-terminal", vec![format!("--working-directory={dir}")]),
        ("konsole", vec!["--workdir".to_string(), dir]),
        ("xterm", Vec::new()),
    ];
    for (program, args) in candidates {
        let mut attempt = Command::new(program);
        attempt.args(args).current_dir(folder);
        if start(attempt).is_ok() {
            return Ok(());
        }
    }
    Err("no supported terminal emulator found (tried gnome-terminal, konsole, xterm)".to_string())
}

fn folder_of(path: &str) -> Result<PathBuf, MessageError> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|error| MessageError::Refused(format!("cannot open {path}: {error}")))?;
    if !canonical.is_dir() {
        return Err(MessageError::Refused(format!("{path} is not a folder")));
    }
    Ok(canonical)
}

fn saved_terminal(app: &tauri::AppHandle) -> Option<String> {
    crate::editor::read_text_setting(app, SETTING_TERMINAL_APP)
}

#[tauri::command]
pub async fn open_in_external_terminal(
    app: tauri::AppHandle,
    path: String,
    terminal: Option<String>,
) -> Result<(), MessageError> {
    let saved = saved_terminal(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let folder = folder_of(&path)?;
        let chosen = chosen_terminal(terminal.as_deref(), saved.as_deref())?;
        folder_in_terminal(chosen, &folder).map_err(MessageError::Failed)
    })
    .await
    .map_err(|e| MessageError::Failed(e.to_string()))?
}

#[tauri::command]
pub async fn open_command_in_external_terminal(
    app: tauri::AppHandle,
    provider_id: String,
    action: String,
) -> Result<(), MessageError> {
    let command = crate::provider_commands::lifecycle_command(&provider_id, &action)
        .map_err(|e| MessageError::Refused(e.to_string()))?;
    let saved = saved_terminal(&app);
    tauri::async_runtime::spawn_blocking(move || {
        let chosen = chosen_terminal(None, saved.as_deref())?;
        command_in_terminal(chosen, command).map_err(MessageError::Failed)
    })
    .await
    .map_err(|e| MessageError::Failed(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_table_has_unique_ids_and_starts_with_the_system_terminal() {
        let mut ids: Vec<&str> = KNOWN_TERMINALS.iter().map(|terminal| terminal.id).collect();
        assert_eq!(ids[0], DEFAULT_TERMINAL);
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), KNOWN_TERMINALS.len());
        let labels: Vec<&str> = KNOWN_TERMINALS
            .iter()
            .map(|terminal| terminal.label)
            .collect();
        assert_eq!(labels, ["Terminal.app", "iTerm", "Warp", "Ghostty"]);
    }

    #[test]
    fn an_explicit_id_outside_the_table_is_refused() {
        for id in ["/Applications/Evil.app", "terminal --evil", "sh", ""] {
            assert!(chosen_terminal(Some(id), None).is_err(), "{id}");
        }
        let everywhere = |_: &KnownTerminal| true;
        assert_eq!(
            chosen_terminal_among(Some("warp"), None, everywhere)
                .unwrap()
                .id,
            "warp"
        );
    }

    #[test]
    fn an_explicit_terminal_that_is_not_installed_is_refused_by_name() {
        let nowhere = |_: &KnownTerminal| false;
        let outcome = chosen_terminal_among(Some("warp"), None, nowhere);
        assert!(
            matches!(&outcome, Err(MessageError::Refused(message)) if message == "Warp is not installed")
        );
    }

    #[test]
    fn a_saved_choice_that_is_gone_or_unknown_falls_back_to_the_system_terminal() {
        assert_eq!(chosen_terminal(None, None).unwrap().id, "terminal");
        assert_eq!(chosen_terminal(None, Some("nope")).unwrap().id, "terminal");
        assert_eq!(
            chosen_terminal(None, Some("terminal")).unwrap().id,
            "terminal"
        );
    }

    #[test]
    fn a_folder_opens_through_open_with_the_app_name_and_the_folder_as_separate_arguments() {
        let launch = folder_launch(
            terminal_by_id("ghostty").unwrap(),
            Path::new("/work/payments-api"),
        );
        assert_eq!(launch.program, "open");
        assert_eq!(launch.args, ["-a", "Ghostty", "/work/payments-api"]);
    }

    #[test]
    fn a_command_is_escaped_for_the_terminal_that_runs_it() {
        let terminal = command_script(terminal_by_id("terminal").unwrap(), "npm i -g \"x\"\\y");
        assert!(terminal.contains("tell application \"Terminal\""));
        assert!(terminal.contains("do script \"npm i -g \\\"x\\\"\\\\y\""));
        let iterm = command_script(terminal_by_id("iterm").unwrap(), "pnpm dev");
        assert!(iterm.contains("tell application \"iTerm\""));
        assert!(iterm.contains("write text \"pnpm dev\""));
    }

    #[test]
    fn only_terminals_that_can_take_a_command_say_so() {
        let flags: Vec<(&str, bool)> = KNOWN_TERMINALS
            .iter()
            .map(|terminal| (terminal.id, terminal.can_run_command))
            .collect();
        assert_eq!(
            flags,
            [
                ("terminal", true),
                ("iterm", true),
                ("warp", false),
                ("ghostty", false)
            ]
        );
    }

    #[test]
    fn a_path_that_is_not_a_folder_is_refused() {
        assert!(folder_of("/definitely/not/here").is_err());
        let file = std::env::temp_dir().join(format!("gb-terminal-{}.txt", std::process::id()));
        std::fs::write(&file, "acme").unwrap();
        assert!(folder_of(&file.to_string_lossy()).is_err());
        std::fs::remove_file(&file).unwrap();
        assert!(folder_of(&std::env::temp_dir().to_string_lossy()).is_ok());
    }
}
