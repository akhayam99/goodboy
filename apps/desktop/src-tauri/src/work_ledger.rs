use rusqlite::{params, Connection};
use serde_json::json;
use tauri::{AppHandle, Manager, Runtime};

use crate::db::Db;
use crate::util::{lock_or_recover, uuid_v4};

pub(crate) const SCRIPT: &str = "script";
pub(crate) const STOPPED_EXIT_CODE: i32 = 143;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct WorkStart {
    pub(crate) run_id: String,
    pub(crate) session_id: String,
    pub(crate) mount_id: Option<String>,
    pub(crate) agent_id: Option<String>,
    pub(crate) kind: &'static str,
    pub(crate) started_at: i64,
    pub(crate) payload: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ScriptStart<'a> {
    pub(crate) run_id: &'a str,
    pub(crate) script_id: &'a str,
    pub(crate) name: &'a str,
    pub(crate) session_id: &'a str,
    pub(crate) mount_id: Option<&'a str>,
    pub(crate) branch: Option<&'a str>,
    pub(crate) cwd: &'a str,
    pub(crate) started_at: i64,
}

pub(crate) fn script_start(start: ScriptStart<'_>) -> WorkStart {
    WorkStart {
        run_id: start.run_id.to_string(),
        session_id: start.session_id.to_string(),
        mount_id: start.mount_id.map(str::to_string),
        agent_id: None,
        kind: SCRIPT,
        started_at: start.started_at,
        payload: json!({
            "scriptId": start.script_id,
            "name": start.name,
            "branch": start.branch,
            "cwd": start.cwd,
        }),
    }
}

pub(crate) fn mount_branch(conn: &Connection, mount_id: &str) -> Option<String> {
    conn.query_row(
        "SELECT branch FROM session_worktrees WHERE id = ?1",
        params![mount_id],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .filter(|branch| !branch.is_empty())
}

pub(crate) fn ledger_exit_code(exit_code: i32, was_stopped: bool) -> i32 {
    if was_stopped {
        return STOPPED_EXIT_CODE;
    }
    exit_code
}

pub(crate) fn saved_mount_branch<R: Runtime>(
    app: &AppHandle<R>,
    mount_id: Option<&str>,
) -> Option<String> {
    let mount_id = mount_id?;
    let db = app.try_state::<Db>()?;
    let conn = lock_or_recover(&db.0);
    mount_branch(&conn, mount_id)
}

pub(crate) fn record_start(conn: &Connection, start: &WorkStart) -> rusqlite::Result<usize> {
    conn.execute(
        "INSERT INTO work_events
           (id, run_id, session_id, mount_id, agent_id, kind, started_at, payload_json, created_at, updated_at)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?7, ?7
         WHERE EXISTS (SELECT 1 FROM sessions WHERE id = ?3)
         ON CONFLICT (run_id) DO NOTHING",
        params![
            uuid_v4(),
            start.run_id,
            start.session_id,
            start.mount_id,
            start.agent_id,
            start.kind,
            start.started_at,
            start.payload.to_string(),
        ],
    )
}

pub(crate) fn record_end(
    conn: &Connection,
    run_id: &str,
    ended_at: i64,
    exit_code: i32,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE work_events SET ended_at = ?2, exit_code = ?3, updated_at = ?2
         WHERE run_id = ?1 AND ended_at IS NULL",
        params![run_id, ended_at, exit_code],
    )
}

pub(crate) fn save_start<R: Runtime>(app: &AppHandle<R>, start: &WorkStart) {
    let Some(db) = app.try_state::<Db>() else {
        return;
    };
    let conn = lock_or_recover(&db.0);
    if let Err(error) = record_start(&conn, start) {
        log::warn!("[work] start_not_saved run={} reason={error}", start.run_id);
    }
}

pub(crate) fn save_end<R: Runtime>(
    app: &AppHandle<R>,
    run_id: &str,
    ended_at: i64,
    exit_code: i32,
) {
    let Some(db) = app.try_state::<Db>() else {
        return;
    };
    let conn = lock_or_recover(&db.0);
    if let Err(error) = record_end(&conn, run_id, ended_at, exit_code) {
        log::warn!("[work] end_not_saved run={run_id} reason={error}");
    }
}

#[cfg(test)]
mod tests;
