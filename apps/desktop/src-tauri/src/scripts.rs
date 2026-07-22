use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

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
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
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

#[derive(Default)]
pub struct ScriptRegistry(Arc<Mutex<HashMap<String, PtySlot>>>);

impl ScriptRegistry {
    pub fn new() -> Self {
        Self::default()
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
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<(), ScriptError> {
    let body = {
        let conn = state.0.lock().map_err(|_| ScriptError::Poisoned)?;
        conn.query_row(
            "SELECT body FROM workspace_scripts WHERE id = ?1 LIMIT 1",
            rusqlite::params![script_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| ScriptError::NotFound(script_id.clone()))?
    };

    let registry_arc = Arc::clone(&registry.0);

    tauri::async_runtime::spawn_blocking(move || {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| ScriptError::Io(e.to_string()))?;

        let mut cmd = CommandBuilder::new("bash");
        cmd.arg("-c");
        cmd.arg(&body);
        cmd.cwd(&cwd);
        cmd.env("PATH", crate::path_env::resolved_path());
        cmd.env("TERM", "xterm-256color");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| ScriptError::Io(e.to_string()))?;
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| ScriptError::Io(e.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| ScriptError::Io(e.to_string()))?;

        let slot: PtySlot = Arc::new(Mutex::new(Some(PtyRun {
            writer,
            master: pair.master,
            child,
        })));

        registry_arc
            .lock()
            .map_err(|_| ScriptError::Poisoned)?
            .insert(run_id.clone(), Arc::clone(&slot));

        let run_id_r = run_id.clone();
        let app_r = app.clone();
        let registry_r = Arc::clone(&registry_arc);

        thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let encoded = STANDARD.encode(&buf[..n]);
                        let _ = app_r.emit(
                            "script-output",
                            ScriptOutputPayload {
                                run_id: run_id_r.clone(),
                                data: encoded,
                            },
                        );
                    }
                }
            }

            let exit_code = {
                let slot = {
                    let guard = registry_r.lock().ok();
                    guard.as_ref().and_then(|m| m.get(&run_id_r).cloned())
                };
                if let Some(slot) = slot {
                    let mut g = slot.lock().unwrap_or_else(|e| e.into_inner());
                    g.as_mut()
                        .and_then(|r| r.child.wait().ok())
                        .map(|s| if s.success() { 0_i32 } else { 1_i32 })
                        .unwrap_or(-1)
                } else {
                    -1
                }
            };

            let _ = app_r.emit(
                "script-exit",
                ScriptExitPayload {
                    run_id: run_id_r.clone(),
                    exit_code,
                },
            );

            if let Ok(mut map) = registry_r.lock() {
                map.remove(&run_id_r);
            }
        });

        Ok(())
    })
    .await
    .map_err(|e| ScriptError::Io(e.to_string()))?
}

// ---------------------------------------------------------------------------
// Command — send keyboard input to a running pty
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn workspace_script_write(
    registry: State<'_, ScriptRegistry>,
    run_id: String,
    data: String,
) -> Result<(), ScriptError> {
    let bytes = STANDARD
        .decode(&data)
        .map_err(|e| ScriptError::Io(e.to_string()))?;

    let slot = {
        let map = registry.0.lock().map_err(|_| ScriptError::Poisoned)?;
        map.get(&run_id).cloned()
    };

    if let Some(slot) = slot {
        if let Ok(mut guard) = slot.lock() {
            if let Some(run) = guard.as_mut() {
                let _ = run.writer.write_all(&bytes);
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Command — resize the pty window
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn workspace_script_resize(
    registry: State<'_, ScriptRegistry>,
    run_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), ScriptError> {
    let slot = {
        let map = registry.0.lock().map_err(|_| ScriptError::Poisoned)?;
        map.get(&run_id).cloned()
    };

    if let Some(slot) = slot {
        if let Ok(guard) = slot.lock() {
            if let Some(run) = guard.as_ref() {
                let _ = run.master.resize(PtySize {
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
        map.remove(&run_id)
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
