use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime, State};

use crate::db::{Db, DbError};
use crate::pty_ring::{
    empty_snapshot, new_shared_ring, push_shared, snapshot_of, ExitedStore, OutputSnapshot,
    SharedRing,
};

// ---------------------------------------------------------------------------
// PTY run slot
// ---------------------------------------------------------------------------

struct PtyRun {
    spawn_id: String,
    _writer: Box<dyn Write + Send>,
    _master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Serialize, Clone)]
struct ScriptOutputPayload {
    #[serde(rename = "runId")]
    run_id: String,
    data: String,
    offset: u64,
}

#[derive(Serialize, Clone)]
struct ScriptExitPayload {
    #[serde(rename = "runId")]
    run_id: String,
    #[serde(rename = "exitCode")]
    exit_code: i32,
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

type PtySlot = Arc<Mutex<Option<PtyRun>>>;

struct ScriptSlot {
    run: PtySlot,
    metadata: LiveScriptRun,
    ring: SharedRing,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LiveScriptRun {
    run_id: String,
    script_id: String,
    name: String,
    session_id: String,
    pid: Option<u32>,
    started_at: u64,
}

#[derive(Default)]
pub struct ScriptRegistry(Arc<Mutex<HashMap<String, ScriptSlot>>>, Arc<ExitedStore>);

impl ScriptRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    fn list_live(&self) -> Result<Vec<LiveScriptRun>, ScriptError> {
        let map = self.0.lock().map_err(|_| ScriptError::Poisoned)?;
        Ok(map.values().map(|slot| slot.metadata.clone()).collect())
    }
}

/// Drains every live script run, killing the whole pty session behind each
/// leader. Killing the leader alone leaves grandchildren holding ports.
pub fn shutdown(registry: &ScriptRegistry) {
    let slots: Vec<PtySlot> = match registry.0.lock() {
        Ok(mut map) => map.drain().map(|(_, slot)| slot.run).collect(),
        Err(_) => return,
    };
    for slot in slots {
        let Ok(mut guard) = slot.lock() else {
            continue;
        };
        let Some(mut run) = guard.take() else {
            continue;
        };
        crate::terminal::reap_pty_session(run.child.process_id(), &run.spawn_id);
        crate::logging::note_kill_failure("script kill", run.child.kill());
    }
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum ScriptError {
    #[error("db error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("db mutex poisoned")]
    Poisoned,
    #[error("script not found: {0}")]
    NotFound(String),
    #[error("io error: {0}")]
    Io(String),
}

crate::util::impl_error_serialize!(ScriptError);

impl ScriptError {
    fn kind(&self) -> &'static str {
        match self {
            ScriptError::Db(_) => "db",
            ScriptError::Poisoned => "poisoned",
            ScriptError::NotFound(_) => "not_found",
            ScriptError::Io(_) => "io",
        }
    }
}

impl From<DbError> for ScriptError {
    fn from(e: DbError) -> Self {
        match e {
            DbError::Sqlite(inner) => ScriptError::Db(inner),
            DbError::Poisoned => ScriptError::Poisoned,
            _ => ScriptError::Io(e.to_string()),
        }
    }
}

// ---------------------------------------------------------------------------
// Command — run a workspace script in a pty
// ---------------------------------------------------------------------------

#[cfg(unix)]
fn signal_number(name: &str) -> Option<i32> {
    if name.is_empty() {
        return None;
    }
    (1..32).find(|signal| {
        let described = unsafe { libc::strsignal(*signal) };
        if described.is_null() {
            return false;
        }
        unsafe { std::ffi::CStr::from_ptr(described) }.to_string_lossy() == name
    })
}

#[cfg(unix)]
fn exit_code_of(status: &portable_pty::ExitStatus) -> i32 {
    let signalled = status.signal().and_then(signal_number);
    if let Some(signal) = signalled {
        return 128 + signal;
    }
    i32::try_from(status.exit_code()).unwrap_or(1)
}

#[cfg(not(unix))]
fn exit_code_of(status: &portable_pty::ExitStatus) -> i32 {
    i32::try_from(status.exit_code()).unwrap_or(1)
}

fn build_script_command(body: &str, cwd: &str, login_env: &[(String, String)]) -> CommandBuilder {
    let mut cmd = CommandBuilder::new("bash");
    cmd.arg("-c");
    cmd.arg(body);
    cmd.cwd(cwd);
    for (key, value) in login_env {
        cmd.env(key, value);
    }
    cmd.env("PATH", crate::path_env::resolved_path());
    cmd.env("TERM", "xterm-256color");
    cmd
}

struct ScriptSpawnRequest<R: Runtime> {
    app: AppHandle<R>,
    registry: Arc<Mutex<HashMap<String, ScriptSlot>>>,
    exited: Arc<ExitedStore>,
    script_id: String,
    name: String,
    body: String,
    run_id: String,
    session_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
}

fn spawn_script<R: Runtime>(request: ScriptSpawnRequest<R>) -> Result<(), ScriptError> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: request.rows,
            cols: request.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| ScriptError::Io(error.to_string()))?;

    let mut cmd =
        build_script_command(&request.body, &request.cwd, crate::path_env::resolved_env());
    let tag = crate::aux_spawn::tag_pty_spawn(&mut cmd, crate::aux_spawn::SpawnKind::Script);
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|error| ScriptError::Io(error.to_string()))?;
    drop(pair.slave);

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| ScriptError::Io(error.to_string()))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| ScriptError::Io(error.to_string()))?;
    let pid = child.process_id();
    if let Some(pid) = pid {
        crate::proc::ledger::record(
            &tag,
            pid,
            crate::proc::ledger::LedgerContext {
                session_id: Some(request.session_id.clone()),
                cwd: Some(request.cwd.clone()),
                ..Default::default()
            },
        );
    }
    let spawn_id = tag.id.clone();
    let slot: PtySlot = Arc::new(Mutex::new(Some(PtyRun {
        spawn_id: tag.id,
        _writer: writer,
        _master: pair.master,
        child,
    })));
    let started_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| ScriptError::Io(error.to_string()))?
        .as_millis() as u64;
    let metadata = LiveScriptRun {
        run_id: request.run_id.clone(),
        script_id: request.script_id,
        name: request.name,
        session_id: request.session_id,
        pid,
        started_at,
    };

    let ring = new_shared_ring();
    request.exited.forget(&request.run_id);
    request
        .registry
        .lock()
        .map_err(|_| ScriptError::Poisoned)?
        .insert(
            request.run_id.clone(),
            ScriptSlot {
                run: Arc::clone(&slot),
                metadata,
                ring: Arc::clone(&ring),
            },
        );

    let run_id = request.run_id;
    let app = request.app;
    let registry = request.registry;
    let exited = request.exited;
    thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(count) => {
                    let offset = push_shared(&ring, &buf[..count]);
                    let encoded = STANDARD.encode(&buf[..count]);
                    let _ = app.emit(
                        "script-output",
                        ScriptOutputPayload {
                            run_id: run_id.clone(),
                            data: encoded,
                            offset,
                        },
                    );
                }
            }
        }

        let exit_code = {
            let slot = {
                let guard = registry.lock().ok();
                guard
                    .as_ref()
                    .and_then(|map| map.get(&run_id).map(|entry| Arc::clone(&entry.run)))
            };
            if let Some(slot) = slot {
                let mut guard = slot.lock().unwrap_or_else(|error| error.into_inner());
                guard
                    .as_mut()
                    .and_then(|run| run.child.wait().ok())
                    .map(|status| exit_code_of(&status))
                    .unwrap_or(-1)
            } else {
                -1
            }
        };

        crate::proc::ledger::forget(&spawn_id);
        exited.keep(&run_id, Arc::clone(&ring), exit_code);
        if let Ok(mut map) = registry.lock() {
            map.remove(&run_id);
        }
        let _ = app.emit(
            "script-exit",
            ScriptExitPayload {
                run_id: run_id.clone(),
                exit_code,
            },
        );
    });

    Ok(())
}

async fn spawn_script_blocking(request: ScriptSpawnRequest<tauri::Wry>) -> Result<(), ScriptError> {
    tauri::async_runtime::spawn_blocking(move || spawn_script(request))
        .await
        .map_err(|error| ScriptError::Io(error.to_string()))?
}

/// Spawns `bash -c <body>` inside a pty, registers the run under `run_id`, and
/// returns immediately. Output is streamed as `script-output` events (base64
/// chunks). A `script-exit` event fires when the process exits or is killed.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn workspace_script_run(
    app: AppHandle,
    state: State<'_, Db>,
    registry: State<'_, ScriptRegistry>,
    script_id: String,
    run_id: String,
    session_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), ScriptError> {
    let (name, body) = {
        let conn = state.0.lock().map_err(|_| ScriptError::Poisoned)?;
        conn.query_row(
            "SELECT name, body FROM project_scripts WHERE id = ?1 LIMIT 1",
            rusqlite::params![script_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|_| ScriptError::NotFound(script_id.clone()))?
    };
    spawn_script_blocking(ScriptSpawnRequest {
        app,
        registry: Arc::clone(&registry.0),
        exited: Arc::clone(&registry.1),
        script_id,
        name,
        body,
        run_id,
        session_id,
        cwd,
        cols,
        rows,
    })
    .await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn workspace_script_run_adhoc(
    app: AppHandle,
    registry: State<'_, ScriptRegistry>,
    script_id: String,
    name: String,
    body: String,
    run_id: Option<String>,
    session_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<String, ScriptError> {
    let run_id = run_id.unwrap_or_else(|| format!("adhoc-{:032x}", rand::random::<u128>()));
    spawn_script_blocking(ScriptSpawnRequest {
        app,
        registry: Arc::clone(&registry.0),
        exited: Arc::clone(&registry.1),
        script_id,
        name,
        body,
        run_id: run_id.clone(),
        session_id,
        cwd,
        cols,
        rows,
    })
    .await?;
    Ok(run_id)
}

#[tauri::command]
pub async fn workspace_script_snapshot(
    registry: State<'_, ScriptRegistry>,
    run_id: String,
) -> Result<OutputSnapshot, ScriptError> {
    snapshot_run(&registry, &run_id)
}

fn snapshot_run(registry: &ScriptRegistry, run_id: &str) -> Result<OutputSnapshot, ScriptError> {
    let ring = {
        let map = registry.0.lock().map_err(|_| ScriptError::Poisoned)?;
        map.get(run_id).map(|slot| Arc::clone(&slot.ring))
    };
    if let Some(ring) = ring {
        return Ok(snapshot_of(&ring, None));
    }
    Ok(registry.1.snapshot(run_id).unwrap_or_else(empty_snapshot))
}

#[tauri::command]
pub async fn workspace_script_list_live(
    registry: State<'_, ScriptRegistry>,
) -> Result<Vec<LiveScriptRun>, ScriptError> {
    registry.list_live()
}

// ---------------------------------------------------------------------------
// Command — interrupt an in-flight workspace script
// ---------------------------------------------------------------------------

fn stop_run(mut run: PtyRun) -> usize {
    let signalled = crate::terminal::reap_pty_session(run.child.process_id(), &run.spawn_id);
    crate::logging::note_kill_failure("script kill", run.child.kill());
    let _ = run.child.wait();
    signalled
}

#[tauri::command]
pub async fn workspace_script_cancel(
    registry: State<'_, ScriptRegistry>,
    run_id: String,
) -> Result<(), ScriptError> {
    let slot = {
        let mut map = registry.0.lock().map_err(|_| ScriptError::Poisoned)?;
        map.remove(&run_id).map(|slot| slot.run)
    };
    let Some(slot) = slot else {
        return Ok(());
    };
    let stopped_run_id = run_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let Ok(mut guard) = slot.lock() else {
            return;
        };
        let Some(run) = guard.take() else {
            return;
        };
        let signalled = stop_run(run);
        log::info!("[script] stop {stopped_run_id}: signalled {signalled} processes");
    })
    .await
    .map_err(|error| ScriptError::Io(error.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn login_env() -> Vec<(String, String)> {
        vec![
            ("GITHUB_PACKAGES_TOKEN".to_string(), "tok".to_string()),
            ("NVM_DIR".to_string(), "/home/u/.nvm".to_string()),
        ]
    }

    #[test]
    fn script_runs_through_bash_with_the_body_and_cwd() {
        let cmd = build_script_command("yarn install", "/tmp/worktree", &login_env());
        let argv: Vec<String> = cmd
            .get_argv()
            .iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert_eq!(argv, vec!["bash", "-c", "yarn install"]);
        assert_eq!(
            cmd.get_cwd().map(|c| c.to_string_lossy().into_owned()),
            Some("/tmp/worktree".to_string())
        );
    }

    #[test]
    fn script_inherits_the_login_shell_environment() {
        let cmd = build_script_command("yarn install", "/tmp/worktree", &login_env());
        assert_eq!(
            cmd.get_env("GITHUB_PACKAGES_TOKEN")
                .map(|v| v.to_string_lossy().into_owned()),
            Some("tok".to_string())
        );
        assert_eq!(
            cmd.get_env("NVM_DIR")
                .map(|v| v.to_string_lossy().into_owned()),
            Some("/home/u/.nvm".to_string())
        );
    }

    #[test]
    fn script_path_and_term_win_over_the_login_environment() {
        let env = vec![
            ("PATH".to_string(), "/stale".to_string()),
            ("TERM".to_string(), "dumb".to_string()),
        ];
        let cmd = build_script_command("echo hi", "/tmp", &env);
        assert_eq!(
            cmd.get_env("TERM")
                .map(|v| v.to_string_lossy().into_owned()),
            Some("xterm-256color".to_string())
        );
        assert_ne!(
            cmd.get_env("PATH")
                .map(|v| v.to_string_lossy().into_owned()),
            Some("/stale".to_string())
        );
    }

    #[test]
    fn registry_retains_and_lists_live_run_metadata() {
        let registry = ScriptRegistry::new();
        let metadata = LiveScriptRun {
            run_id: "run-1".to_string(),
            script_id: "script-1".to_string(),
            name: "Script one".to_string(),
            session_id: "session-1".to_string(),
            pid: Some(4321),
            started_at: 1234,
        };
        registry.0.lock().unwrap().insert(
            metadata.run_id.clone(),
            ScriptSlot {
                run: Arc::new(Mutex::new(None)),
                metadata: metadata.clone(),
                ring: new_shared_ring(),
            },
        );

        assert_eq!(registry.list_live().unwrap(), vec![metadata]);
    }

    #[cfg(unix)]
    fn spawn_pty_run(body: &str) -> (PtyRun, Box<dyn Read + Send>) {
        spawn_pty_run_with_env(body, &[])
    }

    #[cfg(unix)]
    fn spawn_pty_run_with_env(
        body: &str,
        login_env: &[(String, String)],
    ) -> (PtyRun, Box<dyn Read + Send>) {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("open pty");
        let mut cmd = build_script_command(body, "/tmp", login_env);
        let tag = crate::aux_spawn::tag_pty_spawn(&mut cmd, crate::aux_spawn::SpawnKind::Script);
        let child = pair.slave.spawn_command(cmd).expect("spawn script");
        drop(pair.slave);
        let reader = pair.master.try_clone_reader().expect("reader");
        let writer = pair.master.take_writer().expect("writer");
        let run = PtyRun {
            spawn_id: tag.id,
            _writer: writer,
            _master: pair.master,
            child,
        };
        (run, reader)
    }

    #[cfg(unix)]
    fn read_background_pid(reader: &mut dyn Read) -> libc::pid_t {
        let mut seen = String::new();
        let mut buf = [0u8; 256];
        loop {
            let count = reader.read(&mut buf).expect("read pty");
            assert!(count > 0, "pty closed before the pid was printed: {seen}");
            seen.push_str(&String::from_utf8_lossy(&buf[..count]));
            let pid = seen
                .lines()
                .filter_map(|line| line.trim().strip_prefix("pid=")?.parse().ok())
                .next();
            if let Some(pid) = pid {
                return pid;
            }
        }
    }

    #[cfg(unix)]
    #[test]
    fn stop_run_kills_a_descendant_that_ignores_hangup() {
        let (run, mut reader) = spawn_pty_run("trap \"\" HUP; sleep 30 & echo pid=$!; wait");
        let descendant = read_background_pid(&mut reader);
        assert_eq!(unsafe { libc::kill(descendant, 0) }, 0);

        let signalled = stop_run(run);

        assert!(signalled >= 1);
        let mut alive = true;
        for _ in 0..20 {
            if unsafe { libc::kill(descendant, 0) } != 0 {
                alive = false;
                break;
            }
            thread::sleep(std::time::Duration::from_millis(50));
        }
        assert!(!alive, "the script's background process outlived Stop");
    }

    #[cfg(unix)]
    #[test]
    fn stop_run_reaps_an_orphan_that_left_the_session_by_its_tag() {
        use crate::proc::reap::unix::test_support::{
            is_gone, is_running, HELPER_FLAG, HELPER_TEST,
        };
        let exe = std::env::current_exe().expect("test executable");
        let body = format!(
            "(perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' -- '{}' --exact {} --nocapture --test-threads=1 >/dev/null 2>&1 </dev/null & echo pid=$!); sleep 30",
            exe.display(),
            HELPER_TEST
        );
        let env = vec![(HELPER_FLAG.to_string(), "1".to_string())];
        let (run, mut reader) = spawn_pty_run_with_env(&body, &env);
        let orphan = read_background_pid(&mut reader) as u32;
        std::thread::sleep(std::time::Duration::from_millis(500));
        assert!(is_running(orphan));

        stop_run(run);

        assert!(is_gone(orphan), "the orphan outlived Stop");
    }

    #[cfg(unix)]
    fn run_script_to_exit_code(body: &str) -> i32 {
        use tauri::Listener;
        let dir = crate::proc::ledger::test_support::scratch_dir("exit");
        let app = tauri::test::mock_app();
        let (sender, receiver) = std::sync::mpsc::channel::<String>();
        app.handle().listen("script-exit", move |event| {
            let _ = sender.send(event.payload().to_string());
        });
        spawn_script(ScriptSpawnRequest {
            app: app.handle().clone(),
            registry: Arc::new(Mutex::new(HashMap::new())),
            exited: Arc::new(ExitedStore::default()),
            script_id: "script-1".to_string(),
            name: "Exit probe".to_string(),
            body: body.to_string(),
            run_id: "run-exit".to_string(),
            session_id: "session-1".to_string(),
            cwd: dir.to_string_lossy().into_owned(),
            cols: 80,
            rows: 24,
        })
        .expect("spawn the script");
        let payload = receiver
            .recv_timeout(std::time::Duration::from_secs(10))
            .expect("script-exit");
        let _ = std::fs::remove_dir_all(&dir);
        let value: serde_json::Value = serde_json::from_str(&payload).expect("payload json");
        value["exitCode"].as_i64().expect("exit code") as i32
    }

    #[cfg(unix)]
    #[test]
    fn a_finished_script_snapshot_keeps_the_tail_and_the_exit_code() {
        use tauri::Listener;
        let dir = crate::proc::ledger::test_support::scratch_dir("snapshot");
        let app = tauri::test::mock_app();
        let (sender, receiver) = std::sync::mpsc::channel::<String>();
        app.handle().listen("script-exit", move |event| {
            let _ = sender.send(event.payload().to_string());
        });
        let registry = ScriptRegistry::new();
        spawn_script(ScriptSpawnRequest {
            app: app.handle().clone(),
            registry: Arc::clone(&registry.0),
            exited: Arc::clone(&registry.1),
            script_id: "script-1".to_string(),
            name: "Snapshot probe".to_string(),
            body: "i=1; while [ $i -le 600 ]; do echo line-$i; i=$((i+1)); done; exit 4"
                .to_string(),
            run_id: "run-snapshot".to_string(),
            session_id: "session-1".to_string(),
            cwd: dir.to_string_lossy().into_owned(),
            cols: 80,
            rows: 24,
        })
        .expect("spawn the script");
        receiver
            .recv_timeout(std::time::Duration::from_secs(10))
            .expect("script-exit");
        let snapshot = snapshot_run(&registry, "run-snapshot").expect("snapshot");
        let _ = std::fs::remove_dir_all(&dir);
        let text = String::from_utf8(STANDARD.decode(snapshot.data).unwrap()).unwrap();
        assert!(text.contains("line-600"));
        assert!(text.contains("line-1\r\n"));
        assert_eq!(snapshot.offset, 0);
        assert_eq!(snapshot.exit_code, Some(4));
        assert_eq!(
            snapshot_run(&registry, "unknown").expect("empty").data,
            String::new()
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_script_reports_its_real_exit_code() {
        assert_eq!(run_script_to_exit_code("exit 0"), 0);
        assert_eq!(run_script_to_exit_code("exit 3"), 3);
        assert_eq!(run_script_to_exit_code("exit 255"), 255);
    }

    #[cfg(unix)]
    #[test]
    fn a_script_killed_by_sigkill_reports_137() {
        assert_eq!(run_script_to_exit_code("kill -9 $$"), 137);
    }

    #[cfg(unix)]
    #[test]
    fn a_script_killed_by_sigterm_reports_143() {
        assert_eq!(run_script_to_exit_code("kill -15 $$"), 143);
    }

    #[cfg(unix)]
    #[test]
    fn signal_names_map_back_to_their_number() {
        let killed = unsafe { std::ffi::CStr::from_ptr(libc::strsignal(libc::SIGKILL)) }
            .to_string_lossy()
            .into_owned();
        assert_eq!(signal_number(&killed), Some(libc::SIGKILL));
        assert_eq!(signal_number(""), None);
        assert_eq!(signal_number("   "), None);
        assert_eq!(signal_number("not a signal"), None);
        assert_eq!(signal_number(&"x".repeat(100_000)), None);
    }

    #[cfg(unix)]
    #[test]
    fn an_unknown_signal_name_keeps_the_pty_exit_code() {
        assert_eq!(
            exit_code_of(&portable_pty::ExitStatus::with_signal("not a signal")),
            1
        );
        assert_eq!(
            exit_code_of(&portable_pty::ExitStatus::with_exit_code(7)),
            7
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_running_script_is_in_the_ledger_with_its_pid_and_cwd_until_it_ends() {
        let dir = crate::proc::ledger::test_support::scratch_dir("script");
        let cwd = dir.to_string_lossy().into_owned();
        let flag = dir.join("stop");
        let body = format!("while [ ! -e '{}' ]; do sleep 0.05; done", flag.display());
        let app = tauri::test::mock_app();
        let registry = ScriptRegistry::new();

        spawn_script(ScriptSpawnRequest {
            app: app.handle().clone(),
            registry: Arc::clone(&registry.0),
            exited: Arc::clone(&registry.1),
            script_id: "script-1".to_string(),
            name: "Wait for flag".to_string(),
            body,
            run_id: "run-ledger".to_string(),
            session_id: "session-3".to_string(),
            cwd: cwd.clone(),
            cols: 80,
            rows: 24,
        })
        .expect("spawn the script");

        let row = crate::proc::ledger::test_support::wait_for_row(&cwd);
        assert_eq!(row.kind, "script");
        assert_eq!(row.session_id.as_deref(), Some("session-3"));
        assert!(row.pid > 0);
        let live = registry.list_live().expect("list");
        assert_eq!(live.len(), 1);
        assert_eq!(live[0].pid, Some(row.pid));

        std::fs::write(&flag, "").expect("write the flag");

        crate::proc::ledger::test_support::assert_row_gone(&cwd);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
