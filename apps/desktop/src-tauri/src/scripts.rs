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

/// Run a workspace script body via `bash -c`, with cwd set to the workspace
/// root. Captures stdout/stderr/exit. Never errors on a non-zero exit — the
/// caller renders the exit code as a status (✓ / ✗).
#[tauri::command]
pub fn workspace_script_run(
    state: State<'_, Db>,
    script_id: String,
) -> Result<ScriptRunResult, ScriptError> {
    let (body, root) = {
        let conn = state.0.lock().map_err(|_| ScriptError::Poisoned)?;
        conn.query_row(
            "SELECT s.body, w.root_path
             FROM workspace_scripts s
             JOIN workspaces w ON w.id = s.workspace_id
             WHERE s.id = ?1
             LIMIT 1",
            rusqlite::params![script_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|_| ScriptError::NotFound(script_id.clone()))?
    };

    let output = crate::path_env::command("bash")
        .arg("-c")
        .arg(&body)
        .current_dir(&root)
        .output()
        .map_err(|e| ScriptError::Io(e.to_string()))?;

    Ok(ScriptRunResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
