use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsOverrides {
    #[serde(rename = "defaultProviderId")]
    pub default_provider_id: Option<String>,
    #[serde(rename = "defaultWorkflowId")]
    pub default_workflow_id: Option<String>,
    #[serde(rename = "defaultBranchPrefix")]
    pub default_branch_prefix: Option<String>,
    #[serde(rename = "parallelEnabled")]
    pub parallel_enabled: Option<bool>,
    #[serde(rename = "defaultVerbosity")]
    pub default_verbosity: Option<String>,
    #[serde(rename = "providerBindings")]
    pub provider_bindings: Option<serde_json::Value>,
    #[serde(rename = "scoutFanout")]
    pub scout_fanout: Option<bool>,
}

fn bindings_to_text(value: &Option<serde_json::Value>) -> Option<String> {
    match value {
        Some(serde_json::Value::Null) | None => None,
        Some(v) => Some(v.to_string()),
    }
}

fn bindings_from_text(raw: Option<String>) -> Option<serde_json::Value> {
    raw.and_then(|s| serde_json::from_str(&s).ok())
}

#[tauri::command]
pub fn get_workspace_overrides(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Option<SettingsOverrides>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT default_provider_id, default_workflow_id, default_branch_prefix, parallel_enabled, default_verbosity, provider_bindings, scout_fanout
         FROM workspaces WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![workspace_id], |row| {
        let parallel_raw: Option<i64> = row.get(3)?;
        let scout_raw: Option<i64> = row.get(6)?;
        Ok(SettingsOverrides {
            default_provider_id: row.get(0)?,
            default_workflow_id: row.get(1)?,
            default_branch_prefix: row.get(2)?,
            parallel_enabled: parallel_raw.map(|v| v != 0),
            default_verbosity: row.get(4)?,
            provider_bindings: bindings_from_text(row.get(5)?),
            scout_fanout: scout_raw.map(|v| v != 0),
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(DbError::Sqlite)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn set_workspace_overrides(
    state: State<'_, Db>,
    workspace_id: String,
    overrides: SettingsOverrides,
) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let parallel_val: Option<i64> = overrides.parallel_enabled.map(|v| if v { 1 } else { 0 });
    let scout_val: Option<i64> = overrides.scout_fanout.map(|v| if v { 1 } else { 0 });
    let now = crate::util::now_ms();
    conn.execute(
        "UPDATE workspaces
         SET default_provider_id = ?1,
             default_workflow_id = ?2,
             default_branch_prefix = ?3,
             parallel_enabled = ?4,
             default_verbosity = ?5,
             provider_bindings = ?6,
             scout_fanout = ?7,
             updated_at = ?8
         WHERE id = ?9",
        rusqlite::params![
            overrides.default_provider_id,
            overrides.default_workflow_id,
            overrides.default_branch_prefix,
            parallel_val,
            overrides.default_verbosity,
            bindings_to_text(&overrides.provider_bindings),
            scout_val,
            now,
            workspace_id,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn get_session_overrides(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Option<SettingsOverrides>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT default_provider_id, default_workflow_id, default_branch_prefix, parallel_enabled, provider_bindings
         FROM sessions WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![session_id], |row| {
        let parallel_raw: Option<i64> = row.get(3)?;
        Ok(SettingsOverrides {
            default_provider_id: row.get(0)?,
            default_workflow_id: row.get(1)?,
            default_branch_prefix: row.get(2)?,
            parallel_enabled: parallel_raw.map(|v| v != 0),
            default_verbosity: None,
            provider_bindings: bindings_from_text(row.get(4)?),
            scout_fanout: None,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(DbError::Sqlite)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn set_session_overrides(
    state: State<'_, Db>,
    session_id: String,
    overrides: SettingsOverrides,
) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let parallel_val: Option<i64> = overrides.parallel_enabled.map(|v| if v { 1 } else { 0 });
    let now = crate::util::now_ms();
    conn.execute(
        "UPDATE sessions
         SET default_provider_id = ?1,
             default_workflow_id = ?2,
             default_branch_prefix = ?3,
             parallel_enabled = ?4,
             provider_bindings = ?5,
             updated_at = ?6
         WHERE id = ?7",
        rusqlite::params![
            overrides.default_provider_id,
            overrides.default_workflow_id,
            overrides.default_branch_prefix,
            parallel_val,
            bindings_to_text(&overrides.provider_bindings),
            now,
            session_id,
        ],
    )?;
    Ok(())
}
