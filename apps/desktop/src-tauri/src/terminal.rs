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

    fn list_live(&self) -> Result<Vec<LiveTerminal>, TerminalError> {
        let map = self.0.lock().map_err(|_| TerminalError::Poisoned)?;
        Ok(map.keys().cloned().map(|id| LiveTerminal { id }).collect())
    }
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct LiveTerminal {
    id: String,
}

/// Drains every live terminal, killing the whole pty session behind each
/// leader. Killing the leader alone leaves grandchildren holding ports.
pub fn shutdown(registry: &TerminalRegistry) {
    let slots: Vec<SessionSlot> = match registry.0.lock() {
        Ok(mut map) => map.drain().map(|(_, slot)| slot).collect(),
        Err(_) => return,
    };
    for slot in slots {
        let Ok(mut guard) = slot.lock() else {
            continue;
        };
        let Some(mut session) = guard.take() else {
            continue;
        };
        if let Some(leader_pid) = session.child.process_id() {
            terminate_pty_session(leader_pid);
        }
        let _ = session.child.kill();
    }
}

#[derive(Debug, thiserror::Error)]
pub enum TerminalError {
    #[error("registry mutex poisoned")]
    Poisoned,
    #[error("io error: {0}")]
    Io(String),
}

crate::util::impl_error_serialize!(TerminalError);

impl TerminalError {
    fn kind(&self) -> &'static str {
        match self {
            TerminalError::Poisoned => "poisoned",
            TerminalError::Io(_) => "io",
        }
    }
}

fn login_shell() -> String {
    crate::path_env::login_shell()
}

#[cfg(unix)]
const SESSION_DRAIN_POLLS: usize = 6;

#[cfg(unix)]
const SESSION_DRAIN_INTERVAL: std::time::Duration = std::time::Duration::from_millis(50);

#[cfg(unix)]
fn session_descendants(sid: libc::pid_t) -> Vec<libc::pid_t> {
    let Ok(output) = crate::path_env::command("ps")
        .args(["-Ao", "pid="])
        .output()
    else {
        return Vec::new();
    };
    let Ok(text) = String::from_utf8(output.stdout) else {
        return Vec::new();
    };
    text.split_whitespace()
        .filter_map(|token| token.parse::<libc::pid_t>().ok())
        .filter(|pid| *pid != sid && *pid > 1)
        .filter(|pid| unsafe { libc::getsid(*pid) } == sid)
        .collect()
}

#[cfg(unix)]
fn signal_pty_session(sid: libc::pid_t, signal: libc::c_int) {
    for pid in session_descendants(sid) {
        unsafe { libc::kill(pid, signal) };
    }
    unsafe { libc::kill(sid, signal) };
}

#[cfg(unix)]
pub(crate) fn terminate_pty_session(leader_pid: u32) {
    let sid = leader_pid as libc::pid_t;
    if session_descendants(sid).is_empty() {
        return;
    }
    signal_pty_session(sid, libc::SIGTERM);
    for _ in 0..SESSION_DRAIN_POLLS {
        thread::sleep(SESSION_DRAIN_INTERVAL);
        if session_descendants(sid).is_empty() {
            return;
        }
    }
    signal_pty_session(sid, libc::SIGKILL);
}

#[cfg(not(unix))]
pub(crate) fn terminate_pty_session(_leader_pid: u32) {}

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
pub fn terminal_list_live(
    registry: State<'_, TerminalRegistry>,
) -> Result<Vec<LiveTerminal>, TerminalError> {
    registry.list_live()
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
                if let Some(leader_pid) = session.child.process_id() {
                    terminate_pty_session(leader_pid);
                }
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
    fn registry_lists_open_terminal_keys() {
        let registry = TerminalRegistry::new();
        let slot = Arc::new(Mutex::new(None));
        registry
            .0
            .lock()
            .unwrap()
            .insert("session-1::t1".to_string(), slot);

        assert_eq!(
            registry.list_live().unwrap(),
            vec![LiveTerminal {
                id: "session-1::t1".to_string()
            }]
        );
    }

    #[cfg(unix)]
    fn read_announced_pid(reader: &mut Box<dyn Read + Send>) -> libc::pid_t {
        let mut collected = String::new();
        let mut buf = [0u8; 1024];
        for _ in 0..200 {
            let Ok(n) = reader.read(&mut buf) else {
                break;
            };
            if n == 0 {
                break;
            }
            collected.push_str(&String::from_utf8_lossy(&buf[..n]));
            if let Some(rest) = collected.split("BACKGROUND:").nth(1) {
                let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                if digits.len() > 0 && rest.len() > digits.len() {
                    return digits.parse().unwrap();
                }
            }
        }
        panic!("background pid never announced: {collected}");
    }

    #[cfg(unix)]
    fn is_alive(pid: libc::pid_t) -> bool {
        unsafe { libc::kill(pid, 0) == 0 }
    }

    #[cfg(unix)]
    #[test]
    fn terminate_pty_session_kills_backgrounded_descendant() {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut cmd = CommandBuilder::new("/bin/sh");
        cmd.arg("-c");
        cmd.arg("trap '' HUP; sleep 120 & echo BACKGROUND:$! ; sleep 120");
        let mut child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().unwrap();

        let background_pid = read_announced_pid(&mut reader);
        let leader_pid = child.process_id().unwrap();
        assert_eq!(
            unsafe { libc::getsid(background_pid) },
            leader_pid as libc::pid_t,
            "the backgrounded process must share the pty session"
        );

        terminate_pty_session(leader_pid);
        let _ = child.kill();
        let _ = child.wait();

        let mut still_alive = true;
        for _ in 0..60 {
            if !is_alive(background_pid) {
                still_alive = false;
                break;
            }
            thread::sleep(std::time::Duration::from_millis(50));
        }
        assert!(
            !still_alive,
            "backgrounded descendant {background_pid} survived the terminal close"
        );
    }

    #[cfg(unix)]
    #[test]
    fn shutdown_drains_the_registry_and_kills_descendants() {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut cmd = CommandBuilder::new("/bin/sh");
        cmd.arg("-c");
        cmd.arg("trap '' HUP; sleep 120 & echo BACKGROUND:$! ; sleep 120");
        let child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().unwrap();
        let background_pid = read_announced_pid(&mut reader);
        let writer = pair.master.take_writer().unwrap();

        let registry = TerminalRegistry::new();
        registry.0.lock().unwrap().insert(
            "session-1".to_string(),
            Arc::new(Mutex::new(Some(TerminalSession {
                writer,
                master: pair.master,
                child,
            }))),
        );

        shutdown(&registry);

        assert!(registry.0.lock().unwrap().is_empty());
        let mut still_alive = true;
        for _ in 0..60 {
            if !is_alive(background_pid) {
                still_alive = false;
                break;
            }
            thread::sleep(std::time::Duration::from_millis(50));
        }
        assert!(
            !still_alive,
            "backgrounded descendant {background_pid} survived the app shutdown"
        );
    }

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
