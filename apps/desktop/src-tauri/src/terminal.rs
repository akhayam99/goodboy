use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::proc::pty::{InputError, PtyChild, PtyInput};
use crate::pty_ring::{
    empty_snapshot, new_shared_ring, push_shared, snapshot_of, ExitedStore, OutputSnapshot,
    SharedRing,
};
use crate::terminal_scrollback;

struct TerminalSession {
    spawn_id: String,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: PtyChild,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputPayload {
    session_id: String,
    data: String,
    offset: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TerminalExitPayload {
    session_id: String,
    exit_code: i32,
}

type SessionSlot = Arc<Mutex<Option<TerminalSession>>>;

struct TerminalEntry {
    slot: SessionSlot,
    input: PtyInput,
    cwd: String,
    pid: Option<u32>,
    ring: SharedRing,
}

#[derive(Default)]
pub struct TerminalRegistry(Arc<Mutex<HashMap<String, TerminalEntry>>>, Arc<ExitedStore>);

impl TerminalRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    fn list_live(&self) -> Result<Vec<LiveTerminal>, TerminalError> {
        let map = self.0.lock().map_err(|_| TerminalError::Poisoned)?;
        Ok(map
            .iter()
            .map(|(id, entry)| LiveTerminal {
                id: id.clone(),
                cwd: entry.cwd.clone(),
                pid: entry.pid,
                foreground_pid: foreground_leader(&entry.slot),
                foreground_command: None,
            })
            .collect())
    }
}

impl TerminalRegistry {
    pub(crate) fn ended_terminals(&self) -> Vec<crate::ended_work::EndedTerminal> {
        let Ok(live) = self.list_live() else {
            return Vec::new();
        };
        let busy: Vec<(String, u32)> = live
            .into_iter()
            .filter_map(|terminal| match (terminal.pid, terminal.foreground_pid) {
                (Some(shell), Some(foreground)) if shell != foreground => {
                    Some((terminal.id, foreground))
                }
                _ => None,
            })
            .collect();
        let pids: Vec<u32> = busy.iter().map(|(_, pid)| *pid).collect();
        let commands = crate::terminal_foreground::commands_of(&pids);
        busy.into_iter()
            .filter_map(|(id, pid)| {
                let command = commands.get(&pid)?.clone();
                Some(crate::ended_work::EndedTerminal { id, command })
            })
            .collect()
    }
}

fn foreground_leader(slot: &SessionSlot) -> Option<u32> {
    let guard = slot.try_lock().ok()?;
    let session = guard.as_ref()?;
    foreground_of(session.master.as_ref())
}

#[cfg(unix)]
fn foreground_of(master: &dyn portable_pty::MasterPty) -> Option<u32> {
    let leader = master.process_group_leader()?;
    u32::try_from(leader).ok().filter(|pid| *pid > 0)
}

#[cfg(not(unix))]
fn foreground_of(_master: &dyn portable_pty::MasterPty) -> Option<u32> {
    None
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LiveTerminal {
    id: String,
    cwd: String,
    pid: Option<u32>,
    foreground_pid: Option<u32>,
    foreground_command: Option<String>,
}

/// Drains every live terminal, killing the whole pty session behind each
/// leader. Killing the leader alone leaves grandchildren holding ports.
pub fn shutdown(registry: &TerminalRegistry, scrollback_dir: Option<&Path>) {
    let slots: Vec<(SessionSlot, PtyInput)> = match registry.0.lock() {
        Ok(mut map) => map
            .drain()
            .map(|(id, entry)| {
                if let Some(dir) = scrollback_dir {
                    let (bytes, _) = entry
                        .ring
                        .lock()
                        .unwrap_or_else(|error| error.into_inner())
                        .snapshot();
                    if let Err(error) = terminal_scrollback::save(dir, &id, &bytes) {
                        log::warn!("[teardown] terminal scrollback save failed: {error}");
                    }
                }
                (entry.slot, entry.input)
            })
            .collect(),
        Err(_) => return,
    };
    for (slot, _input) in slots {
        let Ok(mut guard) = slot.lock() else {
            continue;
        };
        let Some(mut session) = guard.take() else {
            continue;
        };
        crate::proc::pty::stop(
            &mut session.child,
            &session.spawn_id,
            "terminal session kill",
        );
    }
}

#[derive(Debug, thiserror::Error)]
pub enum TerminalError {
    #[error("registry mutex poisoned")]
    Poisoned,
    #[error("io error: {0}")]
    Io(String),
    #[error("the terminal is not accepting input")]
    Backlogged,
    #[error("the terminal input is closed")]
    InputClosed,
}

crate::util::impl_error_serialize!(TerminalError);

impl TerminalError {
    fn kind(&self) -> &'static str {
        match self {
            TerminalError::Poisoned => "poisoned",
            TerminalError::Io(_) => "io",
            TerminalError::Backlogged => "backlogged",
            TerminalError::InputClosed => "input_closed",
        }
    }
}

fn login_shell() -> String {
    crate::path_env::login_shell()
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
        if let Some(entry) = map.get(&session_id) {
            let guard = entry.slot.lock().map_err(|_| TerminalError::Poisoned)?;
            if guard.is_some() {
                return Ok(());
            }
        }
    }

    let request = TerminalSpawnRequest {
        scrollback_dir: scrollback_dir_of(&app),
        app,
        registry: Arc::clone(&registry.0),
        exited: Arc::clone(&registry.1),
        session_id,
        cwd,
        cols,
        rows,
    };
    tauri::async_runtime::spawn_blocking(move || spawn_terminal(request))
        .await
        .map_err(|e| TerminalError::Io(e.to_string()))?
}

pub(crate) fn scrollback_dir_of<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| terminal_scrollback::dir_in(&dir))
}

struct TerminalSpawnRequest<R: Runtime> {
    scrollback_dir: Option<PathBuf>,
    app: AppHandle<R>,
    registry: Arc<Mutex<HashMap<String, TerminalEntry>>>,
    exited: Arc<ExitedStore>,
    session_id: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
}

fn spawn_terminal<R: Runtime>(request: TerminalSpawnRequest<R>) -> Result<(), TerminalError> {
    let TerminalSpawnRequest {
        scrollback_dir,
        app,
        registry: registry_arc,
        exited,
        session_id: session_id_clone,
        cwd,
        cols,
        rows,
    } = request;
    if let Some(folder) = cwd.as_deref() {
        if !Path::new(folder).is_dir() {
            return Err(TerminalError::Io(format!(
                "The folder {folder} no longer exists"
            )));
        }
    }
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
    let tag = crate::aux_spawn::tag_pty_spawn(&mut cmd, crate::aux_spawn::SpawnKind::Terminal);

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

    let pid = child.process_id();
    if let Some(pid) = pid {
        crate::proc::ledger::record(
            &tag,
            pid,
            crate::proc::ledger::LedgerContext {
                session_id: session_id_clone
                    .rsplit_once("::")
                    .map(|(owner, _)| owner.to_string()),
                cwd: Some(effective_cwd.clone()),
                ..Default::default()
            },
        );
    }
    let spawn_id = tag.id.clone();

    let input = PtyInput::spawn(writer);
    let slot: SessionSlot = Arc::new(Mutex::new(Some(TerminalSession {
        spawn_id: tag.id,
        master: pair.master,
        child,
    })));

    let ring = new_shared_ring();
    if let Some(saved) = scrollback_dir
        .as_deref()
        .and_then(|dir| terminal_scrollback::take(dir, &session_id_clone))
    {
        push_shared(&ring, &saved);
    }
    exited.forget(&session_id_clone);
    registry_arc
        .lock()
        .map_err(|_| TerminalError::Poisoned)?
        .insert(
            session_id_clone.clone(),
            TerminalEntry {
                slot: Arc::clone(&slot),
                input,
                cwd: effective_cwd,
                pid,
                ring: Arc::clone(&ring),
            },
        );

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
                    let offset = push_shared(&ring, &buf[..n]);
                    let encoded = STANDARD.encode(&buf[..n]);
                    let _ = app_r.emit(
                        "terminal-output",
                        TerminalOutputPayload {
                            session_id: sid.clone(),
                            data: encoded,
                            offset,
                        },
                    );
                }
            }
        }

        let (exit_code, is_closed) = {
            let slot = {
                let guard = registry_r.lock().ok();
                guard
                    .as_ref()
                    .and_then(|m| m.get(&sid))
                    .map(|entry| Arc::clone(&entry.slot))
            };
            if let Some(slot) = slot {
                let code = crate::proc::pty::exit_code_of(crate::proc::pty::wait_for_exit(
                    &slot,
                    |session| &mut session.child,
                ));
                (code, false)
            } else {
                (-1, true)
            }
        };

        if !is_closed {
            exited.keep(&sid, Arc::clone(&ring), exit_code);
        }
        crate::proc::ledger::forget(&spawn_id);
        if let Ok(mut map) = registry_r.lock() {
            map.remove(&sid);
        }
        let _ = app_r.emit(
            "terminal-exit",
            TerminalExitPayload {
                session_id: sid.clone(),
                exit_code,
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn terminal_list_live(
    registry: State<'_, TerminalRegistry>,
) -> Result<Vec<LiveTerminal>, TerminalError> {
    let mut live = registry.list_live()?;
    let busy: Vec<u32> = live
        .iter()
        .filter(|terminal| terminal.pid != terminal.foreground_pid)
        .filter_map(|terminal| terminal.foreground_pid)
        .collect();
    if busy.is_empty() {
        return Ok(live);
    }
    let commands = tauri::async_runtime::spawn_blocking(move || {
        crate::terminal_foreground::commands_of(&busy)
    })
    .await
    .unwrap_or_default();
    for terminal in &mut live {
        if terminal.pid != terminal.foreground_pid {
            terminal.foreground_command = terminal
                .foreground_pid
                .and_then(|pid| commands.get(&pid).cloned());
        }
    }
    Ok(live)
}

#[tauri::command]
pub async fn terminal_snapshot(
    registry: State<'_, TerminalRegistry>,
    session_id: String,
) -> Result<OutputSnapshot, TerminalError> {
    snapshot_session(&registry, &session_id)
}

fn snapshot_session(
    registry: &TerminalRegistry,
    session_id: &str,
) -> Result<OutputSnapshot, TerminalError> {
    let ring = {
        let map = registry.0.lock().map_err(|_| TerminalError::Poisoned)?;
        map.get(session_id).map(|entry| Arc::clone(&entry.ring))
    };
    if let Some(ring) = ring {
        return Ok(snapshot_of(&ring, None));
    }
    Ok(registry
        .1
        .snapshot(session_id)
        .unwrap_or_else(empty_snapshot))
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
    write_session(&registry, &session_id, bytes)
}

fn write_session(
    registry: &TerminalRegistry,
    session_id: &str,
    bytes: Vec<u8>,
) -> Result<(), TerminalError> {
    let input = {
        let map = registry.0.lock().map_err(|_| TerminalError::Poisoned)?;
        map.get(session_id).map(|entry| entry.input.clone())
    };
    let Some(input) = input else {
        return Ok(());
    };
    input.send(bytes).map_err(|error| match error {
        InputError::Backlogged => TerminalError::Backlogged,
        InputError::Closed => TerminalError::InputClosed,
    })
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
        map.get(&session_id).map(|entry| Arc::clone(&entry.slot))
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
pub async fn terminal_close(
    app: AppHandle,
    registry: State<'_, TerminalRegistry>,
    session_id: String,
) -> Result<(), TerminalError> {
    if let Some(dir) = scrollback_dir_of(&app) {
        terminal_scrollback::forget(&dir, &session_id)
            .map_err(|e| TerminalError::Io(e.to_string()))?;
    }
    close_session(&registry.0, &registry.1, &session_id)
}

fn close_session(
    registry: &Arc<Mutex<HashMap<String, TerminalEntry>>>,
    exited: &ExitedStore,
    session_id: &str,
) -> Result<(), TerminalError> {
    exited.forget(session_id);
    let removed = {
        let mut map = registry.lock().map_err(|_| TerminalError::Poisoned)?;
        map.remove(session_id)
            .map(|entry| (entry.slot, entry.input))
    };
    if let Some((slot, _input)) = removed {
        if let Ok(mut guard) = slot.lock() {
            if let Some(mut session) = guard.take() {
                crate::proc::pty::stop(
                    &mut session.child,
                    &session.spawn_id,
                    "terminal session kill",
                );
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod wire_shape;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_session_forgets_the_exited_ring_of_a_closed_tab() {
        let registry = TerminalRegistry::new();
        registry.1.keep("session-3::t2", new_shared_ring(), 0);
        assert!(registry.1.snapshot("session-3::t2").is_some());

        close_session(&registry.0, &registry.1, "session-3::t2").expect("close");

        assert!(registry.1.snapshot("session-3::t2").is_none());
    }

    #[test]
    fn registry_lists_open_terminal_keys_with_their_cwd() {
        let registry = TerminalRegistry::new();
        let slot = Arc::new(Mutex::new(None));
        registry.0.lock().unwrap().insert(
            "session-1::t1".to_string(),
            TerminalEntry {
                slot,
                input: PtyInput::spawn(Box::new(std::io::sink())),
                cwd: "/worktrees/api".to_string(),
                pid: Some(4321),
                ring: new_shared_ring(),
            },
        );

        assert_eq!(
            registry.list_live().unwrap(),
            vec![LiveTerminal {
                id: "session-1::t1".to_string(),
                cwd: "/worktrees/api".to_string(),
                pid: Some(4321),
                foreground_pid: None,
                foreground_command: None,
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
                if !digits.is_empty() && rest.len() > digits.len() {
                    return digits.parse().unwrap();
                }
            }
        }
        panic!("background pid never announced: {collected}");
    }

    #[cfg(unix)]
    fn is_alive(pid: libc::pid_t) -> bool {
        crate::proc::signal::exists(pid as u32)
    }

    #[cfg(unix)]
    #[test]
    fn terminate_session_kills_backgrounded_descendant() {
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

        crate::proc::pty::terminate_session(leader_pid);
        crate::logging::note_kill_failure("terminal probe kill", child.kill());
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
            TerminalEntry {
                slot: Arc::new(Mutex::new(Some(TerminalSession {
                    spawn_id: String::new(),
                    master: pair.master,
                    child,
                }))),
                input: PtyInput::spawn(writer),
                cwd: "/".to_string(),
                pid: None,
                ring: new_shared_ring(),
            },
        );

        shutdown(&registry, None);

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

    #[cfg(unix)]
    #[test]
    fn an_open_terminal_is_in_the_ledger_with_its_pid_and_cwd_until_it_closes() {
        let dir = crate::proc::ledger::test_support::scratch_dir("terminal");
        let cwd = dir.to_string_lossy().into_owned();
        let app = tauri::test::mock_app();
        let registry = TerminalRegistry::new();

        spawn_terminal(TerminalSpawnRequest {
            scrollback_dir: None,
            app: app.handle().clone(),
            registry: Arc::clone(&registry.0),
            exited: Arc::clone(&registry.1),
            session_id: "session-7::t1".to_string(),
            cwd: Some(cwd.clone()),
            cols: 80,
            rows: 24,
        })
        .expect("open the terminal");

        let row = crate::proc::ledger::test_support::wait_for_row(&cwd);
        assert_eq!(row.kind, "terminal");
        assert_eq!(row.session_id.as_deref(), Some("session-7"));
        assert!(row.pid > 0);
        let live = registry.list_live().expect("list");
        assert_eq!(live.len(), 1);
        assert_eq!(live[0].pid, Some(row.pid));
        assert!(live[0].foreground_pid.is_some());
        assert!(registry.ended_terminals().is_empty());

        close_session(&registry.0, &registry.1, "session-7::t1").expect("close");

        crate::proc::ledger::test_support::assert_row_gone(&cwd);
        assert!(registry.0.lock().unwrap().is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn terminal_snapshot_returns_the_tail_of_a_busy_pty_with_its_final_line() {
        let dir = crate::proc::ledger::test_support::scratch_dir("terminal-snapshot");
        let cwd = dir.to_string_lossy().into_owned();
        let app = tauri::test::mock_app();
        let registry = TerminalRegistry::new();
        spawn_terminal(TerminalSpawnRequest {
            scrollback_dir: None,
            app: app.handle().clone(),
            registry: Arc::clone(&registry.0),
            exited: Arc::clone(&registry.1),
            session_id: "session-9::t1".to_string(),
            cwd: Some(cwd),
            cols: 80,
            rows: 24,
        })
        .expect("open the terminal");
        let command =
            "i=1; while [ $i -le 600 ]; do printf 'chunk-%04d-%0600d\\n' $i 0; i=$((i+1)); done; echo FINAL-LINE\nexit 7\n";
        write_session(&registry, "session-9::t1", command.as_bytes().to_vec()).unwrap();
        let mut snapshot = snapshot_session(&registry, "session-9::t1").unwrap();
        for _ in 0..200 {
            if snapshot.exit_code.is_some() {
                break;
            }
            thread::sleep(std::time::Duration::from_millis(50));
            snapshot = snapshot_session(&registry, "session-9::t1").unwrap();
        }
        let text = String::from_utf8_lossy(&STANDARD.decode(&snapshot.data).unwrap()).into_owned();
        assert!(text.contains("FINAL-LINE"));
        assert!(snapshot.offset > 0);
        assert_eq!(snapshot.exit_code, Some(7));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn a_reopened_terminal_starts_with_its_saved_scrollback_and_the_file_is_taken() {
        let dir = crate::proc::ledger::test_support::scratch_dir("terminal-restore");
        let cwd = dir.to_string_lossy().into_owned();
        let saved = dir.join("saved");
        terminal_scrollback::save(&saved, "session-11::t1", b"yesterday's build\r\n").unwrap();
        let app = tauri::test::mock_app();
        let registry = TerminalRegistry::new();

        spawn_terminal(TerminalSpawnRequest {
            scrollback_dir: Some(saved.clone()),
            app: app.handle().clone(),
            registry: Arc::clone(&registry.0),
            exited: Arc::clone(&registry.1),
            session_id: "session-11::t1".to_string(),
            cwd: Some(cwd),
            cols: 80,
            rows: 24,
        })
        .expect("open the terminal");

        let snapshot = snapshot_session(&registry, "session-11::t1").unwrap();
        let text = String::from_utf8_lossy(&STANDARD.decode(&snapshot.data).unwrap()).into_owned();
        assert!(text.starts_with("yesterday's build"));
        assert!(terminal_scrollback::take(&saved, "session-11::t1").is_none());
        close_session(&registry.0, &registry.1, "session-11::t1").expect("close");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn opening_a_terminal_in_a_missing_folder_says_the_folder_is_gone() {
        let app = tauri::test::mock_app();
        let registry = TerminalRegistry::new();

        let result = spawn_terminal(TerminalSpawnRequest {
            scrollback_dir: None,
            app: app.handle().clone(),
            registry: Arc::clone(&registry.0),
            exited: Arc::clone(&registry.1),
            session_id: "session-12::t1".to_string(),
            cwd: Some("/mock/harborline/payments-api/gone".to_string()),
            cols: 80,
            rows: 24,
        });

        let message = result
            .err()
            .map(|error| error.to_string())
            .unwrap_or_default();
        assert!(message.contains("no longer exists"), "got: {message}");
        assert!(registry.0.lock().unwrap().is_empty());
    }

    #[cfg(unix)]
    fn register_session_that_never_reads(registry: &TerminalRegistry, session_id: &str) {
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
        cmd.arg("stty raw -echo; sleep 120");
        let tag = crate::aux_spawn::tag_pty_spawn(&mut cmd, crate::aux_spawn::SpawnKind::Terminal);
        let child = pair.slave.spawn_command(cmd).unwrap();
        drop(pair.slave);
        let writer = pair.master.take_writer().unwrap();
        let pid = child.process_id();
        registry.0.lock().unwrap().insert(
            session_id.to_string(),
            TerminalEntry {
                slot: Arc::new(Mutex::new(Some(TerminalSession {
                    spawn_id: tag.id,
                    master: pair.master,
                    child,
                }))),
                input: PtyInput::spawn(writer),
                cwd: "/".to_string(),
                pid,
                ring: new_shared_ring(),
            },
        );
    }

    #[test]
    fn writing_to_a_session_that_is_gone_is_a_quiet_no_op() {
        let registry = TerminalRegistry::new();
        assert!(write_session(&registry, "session-4::t1", b"ls\n".to_vec()).is_ok());
    }

    #[test]
    fn a_session_whose_input_closed_reports_it() {
        let registry = TerminalRegistry::new();
        let input = PtyInput::spawn(Box::new(FailingWriter));
        registry.0.lock().unwrap().insert(
            "session-5::t1".to_string(),
            TerminalEntry {
                slot: Arc::new(Mutex::new(None)),
                input,
                cwd: "/".to_string(),
                pid: None,
                ring: new_shared_ring(),
            },
        );
        let mut closed = false;
        for _ in 0..200 {
            if matches!(
                write_session(&registry, "session-5::t1", b"x".to_vec()),
                Err(TerminalError::InputClosed)
            ) {
                closed = true;
                break;
            }
            thread::sleep(std::time::Duration::from_millis(10));
        }
        assert!(closed, "a dead writer must surface as InputClosed");
    }

    struct FailingWriter;

    impl std::io::Write for FailingWriter {
        fn write(&mut self, _bytes: &[u8]) -> std::io::Result<usize> {
            Err(std::io::Error::new(std::io::ErrorKind::BrokenPipe, "gone"))
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_child_that_never_reads_neither_blocks_writes_nor_close() {
        let registry = TerminalRegistry::new();
        register_session_that_never_reads(&registry, "session-6::t1");
        let started = std::time::Instant::now();
        let mut refusal = None;
        for _ in 0..20_000 {
            let call = std::time::Instant::now();
            let result = write_session(&registry, "session-6::t1", vec![b'a'; 4096]);
            assert!(
                call.elapsed() < std::time::Duration::from_secs(1),
                "terminal_write must return at once"
            );
            if let Err(error) = result {
                refusal = Some(error);
                break;
            }
        }
        assert!(matches!(refusal, Some(TerminalError::Backlogged)));

        close_session(&registry.0, &registry.1, "session-6::t1").expect("close");

        assert!(started.elapsed() < std::time::Duration::from_secs(10));
        assert!(registry.0.lock().unwrap().is_empty());
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
