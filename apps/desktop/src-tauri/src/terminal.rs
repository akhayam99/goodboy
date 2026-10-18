use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::platform::shell::{self, ShellProfile};
use crate::pty_ring::{
    empty_snapshot, new_shared_ring, push_shared, snapshot_of, ExitedStore, OutputSnapshot,
    SharedRing,
};
use crate::terminal_scrollback;

struct TerminalSession {
    spawn_id: String,
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Serialize, Clone)]
struct TerminalOutputPayload {
    #[serde(rename = "sessionId")]
    session_id: String,
    data: String,
    offset: u64,
}

#[derive(Serialize, Clone)]
struct TerminalExitPayload {
    #[serde(rename = "sessionId")]
    session_id: String,
    #[serde(rename = "exitCode")]
    exit_code: i32,
}

type SessionSlot = Arc<Mutex<Option<TerminalSession>>>;

struct TerminalEntry {
    slot: SessionSlot,
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
            })
            .collect())
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
}

/// Drains every live terminal, killing the whole pty session behind each
/// leader. Killing the leader alone leaves grandchildren holding ports.
pub fn shutdown(registry: &TerminalRegistry, scrollback_dir: Option<&Path>) {
    let slots: Vec<SessionSlot> = match registry.0.lock() {
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
                entry.slot
            })
            .collect(),
        Err(_) => return,
    };
    for slot in slots {
        let Ok(mut guard) = slot.lock() else {
            continue;
        };
        let Some(mut session) = guard.take() else {
            continue;
        };
        reap_pty_session(session.child.process_id(), &session.spawn_id);
        crate::logging::note_kill_failure("terminal session kill", session.child.kill());
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

fn default_cwd() -> String {
    crate::platform::paths::home_dir()
        .map(|home| home.to_string_lossy().into_owned())
        .unwrap_or_else(|| "/".to_string())
}

fn shell_command(
    profile: &ShellProfile,
    cwd: &str,
) -> (CommandBuilder, crate::aux_spawn::SpawnTag) {
    let mut cmd = CommandBuilder::new(&profile.program);
    for arg in profile.interactive_args() {
        cmd.arg(arg);
    }
    cmd.cwd(cwd);
    for (key, value) in std::env::vars() {
        cmd.env(key, value);
    }
    cmd.env("PATH", crate::path_env::resolved_path());
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if profile.exports_shell_variable() {
        cmd.env("SHELL", &profile.program);
    }
    for (key, value) in profile.startup_env() {
        cmd.env(key, value);
    }
    let tag = crate::aux_spawn::tag_pty_spawn(&mut cmd, crate::aux_spawn::SpawnKind::Terminal);
    (cmd, tag)
}

fn fallback_notice(failures: &[String], started: &ShellProfile) -> Option<Vec<u8>> {
    if failures.is_empty() {
        return None;
    }
    let reasons = failures.join(". ");
    Some(
        format!(
            "\x1b[2m{reasons}. Opened {} instead.\x1b[0m\r\n",
            started.label
        )
        .into_bytes(),
    )
}

const OUTPUT_BATCH_WINDOW: std::time::Duration = std::time::Duration::from_millis(3);
const OUTPUT_BATCH_LIMIT: usize = 64 * 1024;

struct OutputChunk {
    offset: u64,
    bytes: Vec<u8>,
}

fn next_batch(
    rx: &std::sync::mpsc::Receiver<OutputChunk>,
    window: std::time::Duration,
    limit: usize,
) -> Option<OutputChunk> {
    let mut batch = rx.recv().ok()?;
    let deadline = std::time::Instant::now() + window;
    while batch.bytes.len() < limit {
        let left = deadline.saturating_duration_since(std::time::Instant::now());
        let Ok(more) = rx.recv_timeout(left) else {
            break;
        };
        batch.bytes.extend_from_slice(&more.bytes);
    }
    Some(batch)
}

fn forward_output<R: Runtime>(
    app: AppHandle<R>,
    session_id: String,
    rx: std::sync::mpsc::Receiver<OutputChunk>,
) {
    while let Some(batch) = next_batch(&rx, OUTPUT_BATCH_WINDOW, OUTPUT_BATCH_LIMIT) {
        let _ = app.emit(
            "terminal-output",
            TerminalOutputPayload {
                session_id: session_id.clone(),
                data: STANDARD.encode(&batch.bytes),
                offset: batch.offset,
            },
        );
    }
}

fn emit_output<R: Runtime>(app: &AppHandle<R>, ring: &SharedRing, session_id: &str, bytes: &[u8]) {
    let offset = push_shared(ring, bytes);
    let _ = app.emit(
        "terminal-output",
        TerminalOutputPayload {
            session_id: session_id.to_string(),
            data: STANDARD.encode(bytes),
            offset,
        },
    );
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
pub(crate) fn terminate_pty_session(leader_pid: u32) -> usize {
    let sid = leader_pid as libc::pid_t;
    let signalled = session_descendants(sid).len();
    if signalled == 0 {
        return 0;
    }
    signal_pty_session(sid, libc::SIGTERM);
    for _ in 0..SESSION_DRAIN_POLLS {
        thread::sleep(SESSION_DRAIN_INTERVAL);
        if session_descendants(sid).is_empty() {
            return signalled;
        }
    }
    signal_pty_session(sid, libc::SIGKILL);
    signalled
}

#[cfg(not(unix))]
pub(crate) fn terminate_pty_session(_leader_pid: u32) -> usize {
    0
}

pub(crate) fn reap_pty_session(leader_pid: Option<u32>, spawn_id: &str) -> usize {
    crate::proc::ledger::forget(spawn_id);
    let signalled = leader_pid.map(terminate_pty_session).unwrap_or(0);
    let report = crate::proc::reap::reap(crate::proc::reap::ReapParams {
        leader_pid,
        is_leader_exited: true,
        spawn_id: Some(spawn_id),
    });
    signalled + report.stopped.len()
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
        shell_id: None,
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
    shell_id: Option<String>,
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
        shell_id,
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

    let effective_cwd = cwd.unwrap_or_else(default_cwd);
    let attempts = shell::launch_order(&shell::discover(), shell_id.as_deref());
    let mut failures: Vec<String> = Vec::new();
    let mut started = None;
    for profile in attempts {
        let (cmd, tag) = shell_command(&profile, &effective_cwd);
        match pair.slave.spawn_command(cmd) {
            Ok(child) => {
                started = Some((child, tag, profile));
                break;
            }
            Err(error) => failures.push(format!("{} could not start: {error}", profile.label)),
        }
    }
    drop(pair.slave);
    let Some((child, tag, profile)) = started else {
        if failures.is_empty() {
            return Err(TerminalError::Io(
                "No shell was found on this computer".to_string(),
            ));
        }
        return Err(TerminalError::Io(failures.join(". ")));
    };
    let notice = fallback_notice(&failures, &profile);

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

    let slot: SessionSlot = Arc::new(Mutex::new(Some(TerminalSession {
        spawn_id: tag.id,
        writer,
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
    if let Some(notice) = notice.as_deref() {
        emit_output(&app, &ring, &session_id_clone, notice);
    }
    exited.forget(&session_id_clone);
    registry_arc
        .lock()
        .map_err(|_| TerminalError::Poisoned)?
        .insert(
            session_id_clone.clone(),
            TerminalEntry {
                slot: Arc::clone(&slot),
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
        let (tx, rx) = std::sync::mpsc::channel::<OutputChunk>();
        let forward_app = app_r.clone();
        let forward_sid = sid.clone();
        let forwarder = thread::spawn(move || forward_output(forward_app, forward_sid, rx));
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let offset = push_shared(&ring, &buf[..n]);
                    let _ = tx.send(OutputChunk {
                        offset,
                        bytes: buf[..n].to_vec(),
                    });
                }
            }
        }
        drop(tx);
        let _ = forwarder.join();

        let (exit_code, is_closed) = {
            let slot = {
                let guard = registry_r.lock().ok();
                guard
                    .as_ref()
                    .and_then(|m| m.get(&sid))
                    .map(|entry| Arc::clone(&entry.slot))
            };
            if let Some(slot) = slot {
                let mut g = slot.lock().unwrap_or_else(|e| e.into_inner());
                let code = g
                    .as_mut()
                    .and_then(|r| r.child.wait().ok())
                    .map(|s| s.exit_code() as i32)
                    .unwrap_or(-1);
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
    registry.list_live()
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

    let slot = {
        let map = registry.0.lock().map_err(|_| TerminalError::Poisoned)?;
        map.get(&session_id).map(|entry| Arc::clone(&entry.slot))
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
    let slot = {
        let mut map = registry.lock().map_err(|_| TerminalError::Poisoned)?;
        map.remove(session_id).map(|entry| entry.slot)
    };
    if let Some(slot) = slot {
        if let Ok(mut guard) = slot.lock() {
            if let Some(mut session) = guard.take() {
                reap_pty_session(session.child.process_id(), &session.spawn_id);
                crate::logging::note_kill_failure("terminal session kill", session.child.kill());
            }
        }
    }
    Ok(())
}

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
                    writer,
                    master: pair.master,
                    child,
                }))),
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
            shell_id: None,
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
            shell_id: None,
            cols: 80,
            rows: 24,
        })
        .expect("open the terminal");
        let slot = {
            let map = registry.0.lock().unwrap();
            Arc::clone(&map.get("session-9::t1").unwrap().slot)
        };
        let command =
            "i=1; while [ $i -le 600 ]; do printf 'chunk-%04d-%0600d\\n' $i 0; i=$((i+1)); done; echo FINAL-LINE\nexit 7\n";
        slot.lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .writer
            .write_all(command.as_bytes())
            .unwrap();
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
            shell_id: None,
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
            shell_id: None,
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

    #[test]
    fn output_read_close_together_leaves_as_one_batch_with_the_first_offset() {
        let (tx, rx) = std::sync::mpsc::channel();
        for (offset, text) in [(10u64, "ab"), (12, "cd"), (14, "ef")] {
            tx.send(OutputChunk {
                offset,
                bytes: text.as_bytes().to_vec(),
            })
            .unwrap();
        }
        drop(tx);

        let batch = next_batch(&rx, std::time::Duration::from_millis(50), 1024).unwrap();

        assert_eq!(batch.offset, 10);
        assert_eq!(batch.bytes, b"abcdef");
        assert!(next_batch(&rx, std::time::Duration::from_millis(50), 1024).is_none());
    }

    #[test]
    fn a_batch_stops_growing_at_the_size_limit() {
        let (tx, rx) = std::sync::mpsc::channel();
        for offset in [0u64, 4, 8] {
            tx.send(OutputChunk {
                offset,
                bytes: vec![b'x'; 4],
            })
            .unwrap();
        }

        let first = next_batch(&rx, std::time::Duration::from_millis(50), 6).unwrap();
        let second = next_batch(&rx, std::time::Duration::from_millis(50), 6).unwrap();

        assert_eq!((first.offset, first.bytes.len()), (0, 8));
        assert_eq!((second.offset, second.bytes.len()), (8, 4));
    }

    #[test]
    fn the_first_shell_to_try_exists() {
        let order = shell::launch_order(&shell::discover(), None);
        let first = order.first().expect("at least one shell to try");
        assert!(first.program.exists(), "got: {:?}", first.program);
    }

    #[test]
    fn a_fallback_says_which_shell_opened_and_why_the_first_did_not() {
        let started = ShellProfile {
            id: "powershell".into(),
            kind: shell::ShellKind::WindowsPowerShell,
            label: "Windows PowerShell".into(),
            program: PathBuf::from("powershell.exe"),
            distro: None,
            is_default: false,
        };
        let failures = vec!["PowerShell 7 could not start: access denied".to_string()];

        let notice = String::from_utf8(fallback_notice(&failures, &started).unwrap()).unwrap();

        assert!(notice.contains("PowerShell 7 could not start: access denied"));
        assert!(notice.contains("Opened Windows PowerShell instead."));
        assert!(fallback_notice(&[], &started).is_none());
    }
}

#[cfg(all(test, windows))]
mod windows_conpty {
    use super::*;
    use std::time::{Duration, Instant};

    const MARK: &str = "\u{276F}\u{2713}";

    fn open(registry: &TerminalRegistry, session_id: &str, shell_id: &str) {
        let app = tauri::test::mock_app();
        spawn_terminal(TerminalSpawnRequest {
            scrollback_dir: None,
            app: app.handle().clone(),
            registry: Arc::clone(&registry.0),
            exited: Arc::clone(&registry.1),
            session_id: session_id.to_string(),
            cwd: Some(std::env::temp_dir().to_string_lossy().into_owned()),
            shell_id: Some(shell_id.to_string()),
            cols: 100,
            rows: 30,
        })
        .expect("open the terminal");
    }

    fn type_line(registry: &TerminalRegistry, session_id: &str, line: &str) {
        let slot = {
            let map = registry.0.lock().unwrap();
            Arc::clone(&map.get(session_id).expect("live terminal").slot)
        };
        let mut guard = slot.lock().unwrap();
        let session = guard.as_mut().expect("live session");
        session.writer.write_all(line.as_bytes()).unwrap();
        session.writer.write_all(b"\r").unwrap();
    }

    fn output_of(registry: &TerminalRegistry, session_id: &str) -> String {
        let snapshot = snapshot_session(registry, session_id).unwrap();
        String::from_utf8_lossy(&STANDARD.decode(snapshot.data).unwrap()).into_owned()
    }

    fn wait_for(registry: &TerminalRegistry, session_id: &str, needle: &str) -> String {
        let deadline = Instant::now() + Duration::from_secs(20);
        loop {
            let output = output_of(registry, session_id);
            if output.matches(needle).count() >= 2 || Instant::now() > deadline {
                return output;
            }
            thread::sleep(Duration::from_millis(100));
        }
    }

    #[test]
    fn every_default_shell_prints_utf8_back() {
        let registry = TerminalRegistry::new();
        for profile in shell::launch_order(&shell::discover(), None) {
            let session_id = format!("conpty::{}", profile.id);
            open(&registry, &session_id, &profile.id);
            type_line(&registry, &session_id, &format!("echo {MARK}"));

            let output = wait_for(&registry, &session_id, MARK);

            assert!(
                output.matches(MARK).count() >= 2,
                "{} did not print {MARK} back: {output:?}",
                profile.label
            );
            close_session(&registry.0, &registry.1, &session_id).unwrap();
        }
    }
}
