use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::db::{Db, DbError};

// ---------------------------------------------------------------------------
// PTY run slot
// ---------------------------------------------------------------------------

struct PtyRun {
    _writer: Box<dyn Write + Send>,
    _master: Box<dyn portable_pty::MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

#[derive(Serialize, Clone)]
struct ScriptOutputPayload {
    #[serde(rename = "runId")]
    run_id: String,
    data: String,
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
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LiveScriptRun {
    run_id: String,
    script_id: String,
    name: String,
    session_id: String,
    started_at: u64,
}

#[derive(Default)]
pub struct ScriptRegistry(Arc<Mutex<HashMap<String, ScriptSlot>>>);

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
        if let Some(leader_pid) = run.child.process_id() {
            crate::terminal::terminate_pty_session(leader_pid);
        }
        let _ = run.child.kill();
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

struct ScriptSpawnRequest {
    app: AppHandle,
    registry: Arc<Mutex<HashMap<String, ScriptSlot>>>,
    script_id: String,
    name: String,
    body: String,
    run_id: String,
    session_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
}

fn spawn_script(request: ScriptSpawnRequest) -> Result<(), ScriptError> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: request.rows,
            cols: request.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| ScriptError::Io(error.to_string()))?;

    let cmd = build_script_command(&request.body, &request.cwd, crate::path_env::resolved_env());
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
    let slot: PtySlot = Arc::new(Mutex::new(Some(PtyRun {
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
        started_at,
    };

    request
        .registry
        .lock()
        .map_err(|_| ScriptError::Poisoned)?
        .insert(
            request.run_id.clone(),
            ScriptSlot {
                run: Arc::clone(&slot),
                metadata,
            },
        );

    let run_id = request.run_id;
    let app = request.app;
    let registry = request.registry;
    thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(count) => {
                    let encoded = STANDARD.encode(&buf[..count]);
                    let _ = app.emit(
                        "script-output",
                        ScriptOutputPayload {
                            run_id: run_id.clone(),
                            data: encoded,
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
                    .map(|status| match status.success() {
                        true => 0_i32,
                        false => 1_i32,
                    })
                    .unwrap_or(-1)
            } else {
                -1
            }
        };

        let _ = app.emit(
            "script-exit",
            ScriptExitPayload {
                run_id: run_id.clone(),
                exit_code,
            },
        );
        if let Ok(mut map) = registry.lock() {
            map.remove(&run_id);
        }
    });

    Ok(())
}

async fn spawn_script_blocking(request: ScriptSpawnRequest) -> Result<(), ScriptError> {
    tauri::async_runtime::spawn_blocking(move || spawn_script(request))
        .await
        .map_err(|error| ScriptError::Io(error.to_string()))?
}

/// Spawns `bash -c <body>` inside a pty, registers the run under `run_id`, and
/// returns immediately. Output is streamed as `script-output` events (base64
/// chunks). A `script-exit` event fires when the process exits or is killed.
#[tauri::command]
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
pub fn workspace_script_list_live(
    registry: State<'_, ScriptRegistry>,
) -> Result<Vec<LiveScriptRun>, ScriptError> {
    registry.list_live()
}

// ---------------------------------------------------------------------------
// Command — interrupt an in-flight workspace script
// ---------------------------------------------------------------------------

/// Removes the run from the registry and kills the pty child. Dropping the
/// master sends SIGHUP to the entire process group, cleaning up descendants.
#[tauri::command]
pub fn workspace_script_cancel(
    registry: State<'_, ScriptRegistry>,
    run_id: String,
) -> Result<(), ScriptError> {
    let slot = {
        let mut map = registry.0.lock().map_err(|_| ScriptError::Poisoned)?;
        map.remove(&run_id).map(|slot| slot.run)
    };
    if let Some(slot) = slot {
        if let Ok(mut guard) = slot.lock() {
            if let Some(mut run) = guard.take() {
                let _ = run.child.kill();
                // Dropping `run.master` sends SIGHUP to the pty process group.
            }
        }
    }
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
            started_at: 1234,
        };
        registry.0.lock().unwrap().insert(
            metadata.run_id.clone(),
            ScriptSlot {
                run: Arc::new(Mutex::new(None)),
                metadata: metadata.clone(),
            },
        );

        assert_eq!(registry.list_live().unwrap(), vec![metadata]);
    }
}
