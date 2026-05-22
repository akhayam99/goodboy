use std::collections::HashMap;
use std::io::Read;
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use serde::Serialize;
use tauri::State;

use crate::db::{Db, DbError};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ScriptRunResult {
    pub stdout: String,
    pub stderr: String,
    #[serde(rename = "exitCode")]
    pub exit_code: i32,
}

// ---------------------------------------------------------------------------
// Process registry
// ---------------------------------------------------------------------------

type ChildSlot = Arc<Mutex<Option<Child>>>;

/// Keeps a kill handle for every in-flight script run, keyed by `run_id`, so
/// `workspace_script_cancel` can interrupt one. Mirrors `turn::TurnRegistry`.
#[derive(Default)]
pub struct ScriptRegistry(pub Arc<Mutex<HashMap<String, ChildSlot>>>);

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

impl Serialize for ScriptError {
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
// Command — run a user-defined workspace script
// ---------------------------------------------------------------------------

/// Run a workspace script body via `bash -c`, with cwd set to the caller-
/// supplied session worktree. Captures stdout/stderr/exit. Never errors on a
/// non-zero exit — the caller renders the exit code as a status (✓ / ✗).
///
/// The child is registered under `run_id` so `workspace_script_cancel` can
/// kill it. stdout/stderr are drained on separate threads — a chatty script
/// could otherwise deadlock by filling one pipe buffer while we read the
/// other — and both reads run with the registry slot unlocked so a concurrent
/// cancel can lock the slot and land the kill.
#[tauri::command]
pub async fn workspace_script_run(
    state: State<'_, Db>,
    registry: State<'_, ScriptRegistry>,
    script_id: String,
    run_id: String,
    cwd: String,
) -> Result<ScriptRunResult, ScriptError> {
    let body = {
        let conn = state.0.lock().map_err(|_| ScriptError::Poisoned)?;
        conn.query_row(
            "SELECT body FROM workspace_scripts WHERE id = ?1 LIMIT 1",
            rusqlite::params![script_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| ScriptError::NotFound(script_id.clone()))?
    };

    let registry = Arc::clone(&registry.0);

    tauri::async_runtime::spawn_blocking(move || {
        let mut child = crate::path_env::command("bash")
            .arg("-c")
            .arg(&body)
            .current_dir(&cwd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| ScriptError::Io(e.to_string()))?;

        let mut stdout = child
            .stdout
            .take()
            .ok_or_else(|| ScriptError::Io("no stdout".to_string()))?;
        let mut stderr = child
            .stderr
            .take()
            .ok_or_else(|| ScriptError::Io("no stderr".to_string()))?;

        let slot: ChildSlot = Arc::new(Mutex::new(Some(child)));
        registry
            .lock()
            .map_err(|_| ScriptError::Poisoned)?
            .insert(run_id.clone(), Arc::clone(&slot));

        let stderr_thread = thread::spawn(move || {
            let mut buf = Vec::new();
            let _ = stderr.read_to_end(&mut buf);
            buf
        });
        let mut stdout_buf = Vec::new();
        let _ = stdout.read_to_end(&mut stdout_buf);
        let stderr_buf = stderr_thread.join().unwrap_or_default();

        // Both pipes are at EOF: the process has exited or is about to, so the
        // brief slot lock taken to wait can't stall a concurrent cancel.
        let exit_code = match slot.lock() {
            Ok(mut guard) => guard
                .as_mut()
                .and_then(|c| c.wait().ok())
                .and_then(|status| status.code())
                .unwrap_or(-1),
            Err(_) => -1,
        };
        if let Ok(mut map) = registry.lock() {
            map.remove(&run_id);
        }

        Ok(ScriptRunResult {
            stdout: String::from_utf8_lossy(&stdout_buf).to_string(),
            stderr: String::from_utf8_lossy(&stderr_buf).to_string(),
            exit_code,
        })
    })
    .await
    .map_err(|e| ScriptError::Io(e.to_string()))?
}

// ---------------------------------------------------------------------------
// Command — interrupt an in-flight workspace script
// ---------------------------------------------------------------------------

/// Kill the child registered under `run_id`. A run that already finished, or a
/// never-registered id, is a no-op success — the frontend fires this on a stop
/// click that can race the run completing on its own.
#[tauri::command]
pub fn workspace_script_cancel(
    registry: State<'_, ScriptRegistry>,
    run_id: String,
) -> Result<(), ScriptError> {
    let slot = {
        let map = registry.0.lock().map_err(|_| ScriptError::Poisoned)?;
        map.get(&run_id).cloned()
    };
    if let Some(slot) = slot {
        if let Ok(mut guard) = slot.lock() {
            if let Some(child) = guard.as_mut() {
                let _ = child.kill();
            }
        }
    }
    Ok(())
}
