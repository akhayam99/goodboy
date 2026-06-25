use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

struct TerminalSession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Serialize, Clone)]
struct TerminalOutputPayload {
    #[serde(rename = "sessionId")]
    session_id: String,
    data: String,
}

#[derive(Serialize, Clone)]
struct TerminalExitPayload {
    #[serde(rename = "sessionId")]
    session_id: String,
    #[serde(rename = "exitCode")]
    exit_code: i32,
}

type SessionSlot = Arc<Mutex<Option<TerminalSession>>>;

#[derive(Default)]
pub struct TerminalRegistry(Arc<Mutex<HashMap<String, SessionSlot>>>);

impl TerminalRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum TerminalError {
    #[error("registry mutex poisoned")]
    Poisoned,
    #[error("io error: {0}")]
    Io(String),
}

impl Serialize for TerminalError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serde_json::Map::new();
        map.insert(
            "kind".to_string(),
            serde_json::Value::String(self.kind().to_string()),
        );
        map.insert(
            "message".to_string(),
            serde_json::Value::String(self.to_string()),
        );
        serde_json::Value::Object(map).serialize(serializer)
    }
}

impl TerminalError {
    fn kind(&self) -> &'static str {
        match self {
            TerminalError::Poisoned => "poisoned",
            TerminalError::Io(_) => "io",
        }
    }
}

fn login_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        let shell = shell.trim();
        if !shell.is_empty() && std::path::Path::new(shell).exists() {
            return shell.to_string();
        }
    }
    for candidate in shell_fallbacks() {
        if std::path::Path::new(candidate).exists() {
            return (*candidate).to_string();
        }
    }
    "/bin/sh".to_string()
}

#[cfg(target_os = "macos")]
fn shell_fallbacks() -> &'static [&'static str] {
    &["/bin/zsh", "/bin/bash"]
}

#[cfg(target_os = "linux")]
fn shell_fallbacks() -> &'static [&'static str] {
    &["/bin/bash", "/bin/zsh"]
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn shell_fallbacks() -> &'static [&'static str] {
    &["/bin/sh"]
}

#[tauri::command]
pub async fn terminal_open(
    app: AppHandle,
    registry: State<'_, TerminalRegistry>,
    session_id: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), TerminalError> {
    {
        let map = registry.0.lock().map_err(|_| TerminalError::Poisoned)?;
        if let Some(slot) = map.get(&session_id) {
            let guard = slot.lock().map_err(|_| TerminalError::Poisoned)?;
            if guard.is_some() {
                return Ok(());
            }
        }
    }

    let registry_arc = Arc::clone(&registry.0);
    let session_id_clone = session_id.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| TerminalError::Io(e.to_string()))?;

        let shell = login_shell();
        let mut cmd = CommandBuilder::new(&shell);
        cmd.arg("-l");
        cmd.arg("-i");

        let effective_cwd =
            cwd.unwrap_or_else(|| std::env::var("HOME").unwrap_or_else(|_| "/".to_string()));
        cmd.cwd(&effective_cwd);

        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }
        cmd.env("PATH", crate::path_env::resolved_path());
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("SHELL", &shell);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| TerminalError::Io(e.to_string()))?;
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| TerminalError::Io(e.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| TerminalError::Io(e.to_string()))?;

        let slot: SessionSlot = Arc::new(Mutex::new(Some(TerminalSession {
            writer,
            master: pair.master,
            child,
        })));

        registry_arc
            .lock()
            .map_err(|_| TerminalError::Poisoned)?
            .insert(session_id_clone.clone(), Arc::clone(&slot));

        let sid = session_id_clone.clone();
        let app_r = app.clone();
        let registry_r = Arc::clone(&registry_arc);

        thread::spawn(move || {
            let mut reader = reader;
            let mut buf = vec![0u8; 65536];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let encoded = STANDARD.encode(&buf[..n]);
                        let _ = app_r.emit(
                            "terminal-output",
                            TerminalOutputPayload {
                                session_id: sid.clone(),
                                data: encoded,
                            },
                        );
                    }
                }
            }

            let exit_code = {
                let slot = {
                    let guard = registry_r.lock().ok();
                    guard.as_ref().and_then(|m| m.get(&sid).cloned())
                };
                if let Some(slot) = slot {
                    let mut g = slot.lock().unwrap_or_else(|e| e.into_inner());
                    g.as_mut()
                        .and_then(|r| r.child.wait().ok())
                        .map(|s| s.exit_code() as i32)
                        .unwrap_or(-1)
                } else {
                    -1
                }
            };

            let _ = app_r.emit(
                "terminal-exit",
                TerminalExitPayload {
                    session_id: sid.clone(),
                    exit_code,
                },
            );

            if let Ok(mut map) = registry_r.lock() {
                map.remove(&sid);
            }
        });

        Ok(())
    })
    .await
    .map_err(|e| TerminalError::Io(e.to_string()))?
}

#[tauri::command]
pub fn terminal_write(
    registry: State<'_, TerminalRegistry>,
    session_id: String,
    data: String,
) -> Result<(), TerminalError> {
    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| TerminalError::Io(e.to_string()))?;

    let slot = {
        let map = registry.0.lock().map_err(|_| TerminalError::Poisoned)?;
        map.get(&session_id).cloned()
    };

    if let Some(slot) = slot {
        if let Ok(mut guard) = slot.lock() {
            if let Some(session) = guard.as_mut() {
                let _ = session.writer.write_all(&bytes);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    registry: State<'_, TerminalRegistry>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), TerminalError> {
    let slot = {
        let map = registry.0.lock().map_err(|_| TerminalError::Poisoned)?;
        map.get(&session_id).cloned()
    };

    if let Some(slot) = slot {
        if let Ok(guard) = slot.lock() {
            if let Some(session) = guard.as_ref() {
                let _ = session.master.resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                });
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_close(
    registry: State<'_, TerminalRegistry>,
    session_id: String,
) -> Result<(), TerminalError> {
    let slot = {
        let mut map = registry.0.lock().map_err(|_| TerminalError::Poisoned)?;
        map.remove(&session_id)
    };
    if let Some(slot) = slot {
        if let Ok(mut guard) = slot.lock() {
            if let Some(mut session) = guard.take() {
                let _ = session.child.kill();
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_shell_returns_existing_executable() {
        let shell = login_shell();
        assert!(
            std::path::Path::new(&shell).exists(),
            "login_shell must return an existing path, got: {}",
            shell
        );
    }
}
