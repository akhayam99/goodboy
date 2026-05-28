// Optional escape hatch: spawn an OS-native terminal window with a command
// preloaded. The primary provider-lifecycle flow runs everything in-app via
// an embedded PTY (see provider_lifecycle.rs). This module exists for the
// "run this in my own terminal instead" button surfaced in the connect
// modal, for power users who prefer their shell or who hit a corner case
// (npm EACCES, slow sudo prompt, missing certs) the embedded PTY cannot
// handle gracefully.
//
// macOS: AppleScript driving Terminal.app. Linux: probe gnome-terminal /
// konsole / xterm in that order. Windows: cmd.exe via `start cmd /k`.

use std::process::Command;

#[cfg(target_os = "macos")]
fn spawn_in_external_terminal(command: &str) -> Result<(), String> {
    // `do script` opens a Terminal window but does not raise Terminal.app
    // when Goodboy is frontmost; the explicit `activate` brings it forward.
    let escaped = command.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        "tell application \"Terminal\"\n  do script \"{}\"\n  activate\nend tell",
        escaped
    );
    Command::new("osascript")
        .args(["-e", &script])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn spawn_in_external_terminal(command: &str) -> Result<(), String> {
    let terminals: &[(&str, &[&str])] = &[
        ("gnome-terminal", &["--", "bash", "-c"]),
        ("konsole", &["-e", "bash", "-c"]),
        ("xterm", &["-e", "bash", "-c"]),
    ];
    for (term, base_args) in terminals {
        let mut args: Vec<&str> = base_args.to_vec();
        let cmd_with_pause = format!("{}; read -p 'press enter to close'", command);
        args.push(&cmd_with_pause);
        if Command::new(term).args(&args).spawn().is_ok() {
            return Ok(());
        }
    }
    Err("no supported terminal emulator found (tried gnome-terminal, konsole, xterm)".to_string())
}

#[cfg(target_os = "windows")]
fn spawn_in_external_terminal(command: &str) -> Result<(), String> {
    Command::new("cmd")
        .args(["/c", "start", "cmd", "/k", command])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn spawn_in_external_terminal(_command: &str) -> Result<(), String> {
    Err("unsupported platform".to_string())
}

/// Open the user's system terminal with the given command preloaded. Used
/// as the explicit "do it in my own shell" escape hatch in the provider
/// connect modal. The embedded PTY remains the primary path; this returns
/// to the user only when they ask for it.
#[tauri::command]
pub fn open_command_in_external_terminal(command: String) -> Result<(), String> {
    spawn_in_external_terminal(&command)
}
