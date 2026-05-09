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
}

#[tauri::command]
pub fn get_workspace_overrides(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Option<SettingsOverrides>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT default_provider_id, default_workflow_id, default_branch_prefix, parallel_enabled
         FROM workspaces WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![workspace_id], |row| {
        let parallel_raw: Option<i64> = row.get(3)?;
        Ok(SettingsOverrides {
            default_provider_id: row.get(0)?,
            default_workflow_id: row.get(1)?,
            default_branch_prefix: row.get(2)?,
            parallel_enabled: parallel_raw.map(|v| v != 0),
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
    let now = now_ms();
    conn.execute(
        "UPDATE workspaces
         SET default_provider_id = ?1,
             default_workflow_id = ?2,
             default_branch_prefix = ?3,
             parallel_enabled = ?4,
             updated_at = ?5
         WHERE id = ?6",
        rusqlite::params![
            overrides.default_provider_id,
            overrides.default_workflow_id,
            overrides.default_branch_prefix,
            parallel_val,
            now,
            workspace_id,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn get_task_overrides(
    state: State<'_, Db>,
    task_id: String,
) -> Result<Option<SettingsOverrides>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT default_provider_id, default_workflow_id, default_branch_prefix, parallel_enabled
         FROM tasks WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![task_id], |row| {
        let parallel_raw: Option<i64> = row.get(3)?;
        Ok(SettingsOverrides {
            default_provider_id: row.get(0)?,
            default_workflow_id: row.get(1)?,
            default_branch_prefix: row.get(2)?,
            parallel_enabled: parallel_raw.map(|v| v != 0),
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(DbError::Sqlite)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn set_task_overrides(
    state: State<'_, Db>,
    task_id: String,
    overrides: SettingsOverrides,
) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let parallel_val: Option<i64> = overrides.parallel_enabled.map(|v| if v { 1 } else { 0 });
    let now = now_ms();
    conn.execute(
        "UPDATE tasks
         SET default_provider_id = ?1,
             default_workflow_id = ?2,
             default_branch_prefix = ?3,
             parallel_enabled = ?4,
             updated_at = ?5
         WHERE id = ?6",
        rusqlite::params![
            overrides.default_provider_id,
            overrides.default_workflow_id,
            overrides.default_branch_prefix,
            parallel_val,
            now,
            task_id,
        ],
    )?;
    Ok(())
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
