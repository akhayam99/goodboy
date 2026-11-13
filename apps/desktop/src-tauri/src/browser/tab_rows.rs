use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use super::guard::{self, AppOrigins};
use super::local;
use super::reason::{
    self, INVALID_ADDRESS, NOT_WEB_ADDRESS, TAB_ROWS_CHANGED, TAB_ROWS_FAILED, TAB_ROW_GONE,
    TAB_ROW_OWNER,
};
use super::registry::BrowserRegistry;
use super::visit_rows;
use crate::db::Db;
use crate::util::{now_ms, MessageError};

const MAX_ADDRESS_BYTES: usize = 8192;
const MAX_TITLE_CHARS: usize = 512;
const COLUMNS: &str = "id, session_id, project_id, url, title, position, created_at, updated_at";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TabRow {
    pub(crate) id: String,
    pub(crate) session_id: Option<String>,
    pub(crate) project_id: Option<String>,
    pub(crate) url: String,
    pub(crate) title: String,
    pub(crate) position: i64,
    pub(crate) created_at: i64,
    pub(crate) updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub(crate) enum TabOwner {
    Session { session_id: String },
    Project { project_id: String },
}

impl TabOwner {
    fn column(&self) -> &'static str {
        match self {
            TabOwner::Session { .. } => "session_id",
            TabOwner::Project { .. } => "project_id",
        }
    }

    fn id(&self) -> &str {
        match self {
            TabOwner::Session { session_id } => session_id,
            TabOwner::Project { project_id } => project_id,
        }
    }

    fn owns(&self, row: &TabRow) -> bool {
        let held = match self {
            TabOwner::Session { .. } => row.session_id.as_deref(),
            TabOwner::Project { .. } => row.project_id.as_deref(),
        };
        held == Some(self.id())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OwnerArgs {
    owner: TabOwner,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveArgs {
    id: String,
    owner: TabOwner,
    url: String,
    title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReorderArgs {
    owner: TabOwner,
    ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteArgs {
    id: String,
    owner: TabOwner,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionRowsArgs {
    session_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceRowsArgs {
    workspace_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MoveArgs {
    id: String,
    session_id: String,
    project_id: String,
}

fn db_failed(error: rusqlite::Error) -> MessageError {
    log::warn!("[browser] tab_rows_failed reason={error}");
    reason::failed(TAB_ROWS_FAILED)
}

fn read_row(row: &Row) -> rusqlite::Result<TabRow> {
    Ok(TabRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        project_id: row.get(2)?,
        url: row.get(3)?,
        title: row.get(4)?,
        position: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn find(conn: &Connection, id: &str) -> Result<Option<TabRow>, MessageError> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM browser_tabs WHERE id = ?1"),
        params![id],
        read_row,
    )
    .optional()
    .map_err(db_failed)
}

fn require(conn: &Connection, id: &str) -> Result<TabRow, MessageError> {
    find(conn, id)?.ok_or_else(|| reason::failed(TAB_ROW_GONE))
}

fn next_position(conn: &Connection, owner: &TabOwner) -> Result<i64, MessageError> {
    conn.query_row(
        &format!(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM browser_tabs WHERE {} = ?1",
            owner.column()
        ),
        params![owner.id()],
        |row| row.get(0),
    )
    .map_err(db_failed)
}

fn storable_address(address: &str, origins: &AppOrigins) -> Result<String, MessageError> {
    if address.len() > MAX_ADDRESS_BYTES {
        return Err(reason::refused(INVALID_ADDRESS));
    }
    let mut url = guard::parse_address(address).ok_or_else(|| reason::refused(INVALID_ADDRESS))?;
    if local::is_file_address(&url) {
        return Ok(url.to_string());
    }
    if !guard::may_open(&url, origins) {
        return Err(reason::refused(NOT_WEB_ADDRESS));
    }
    let _ = url.set_username("");
    let _ = url.set_password(None);
    Ok(url.to_string())
}

fn storable_title(title: &str) -> String {
    title.trim().chars().take(MAX_TITLE_CHARS).collect()
}

pub(crate) fn list_rows(conn: &Connection, owner: &TabOwner) -> Result<Vec<TabRow>, MessageError> {
    let mut statement = conn
        .prepare(&format!(
            "SELECT {COLUMNS} FROM browser_tabs WHERE {} = ?1 ORDER BY position, created_at, id",
            owner.column()
        ))
        .map_err(db_failed)?;
    let rows = statement
        .query_map(params![owner.id()], read_row)
        .map_err(db_failed)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(db_failed)?;
    Ok(rows)
}

pub(crate) fn list_workspace_rows(
    conn: &Connection,
    workspace_id: &str,
) -> Result<Vec<TabRow>, MessageError> {
    let mut statement = conn
        .prepare(&format!(
            "SELECT {COLUMNS} FROM browser_tabs
             WHERE session_id IN (SELECT id FROM sessions WHERE workspace_id = ?1)
                OR project_id IN (SELECT id FROM projects WHERE workspace_id = ?1)
             ORDER BY position, created_at, id"
        ))
        .map_err(db_failed)?;
    let rows = statement
        .query_map(params![workspace_id], read_row)
        .map_err(db_failed)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(db_failed)?;
    Ok(rows)
}

pub(crate) fn save_row(
    conn: &Connection,
    origins: &AppOrigins,
    args: &SaveArgs,
    now: i64,
) -> Result<TabRow, MessageError> {
    let url = storable_address(&args.url, origins)?;
    let title = storable_title(&args.title);
    let transaction = conn.unchecked_transaction().map_err(db_failed)?;
    match find(&transaction, &args.id)? {
        Some(existing) => {
            if !args.owner.owns(&existing) {
                return Err(reason::refused(TAB_ROW_OWNER));
            }
            transaction
                .execute(
                    "UPDATE browser_tabs SET url = ?2, title = ?3, updated_at = ?4 WHERE id = ?1",
                    params![args.id, url, title, now],
                )
                .map_err(db_failed)?;
        }
        None => {
            let position = next_position(&transaction, &args.owner)?;
            let (session_id, project_id) = match &args.owner {
                TabOwner::Session { session_id } => (Some(session_id.as_str()), None),
                TabOwner::Project { project_id } => (None, Some(project_id.as_str())),
            };
            transaction
                .execute(
                    "INSERT INTO browser_tabs (id, session_id, project_id, url, title, position, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
                    params![args.id, session_id, project_id, url, title, position, now],
                )
                .map_err(db_failed)?;
        }
    }
    let saved = require(&transaction, &args.id)?;
    transaction.commit().map_err(db_failed)?;
    Ok(saved)
}

pub(crate) fn reorder_rows(
    conn: &Connection,
    owner: &TabOwner,
    ids: &[String],
    now: i64,
) -> Result<Vec<TabRow>, MessageError> {
    let transaction = conn.unchecked_transaction().map_err(db_failed)?;
    let current = list_rows(&transaction, owner)?;
    let is_same_set = current.len() == ids.len() && current.iter().all(|row| ids.contains(&row.id));
    if !is_same_set {
        return Err(reason::refused(TAB_ROWS_CHANGED));
    }
    for (position, id) in ids.iter().enumerate() {
        transaction
            .execute(
                "UPDATE browser_tabs SET position = ?2, updated_at = ?3 WHERE id = ?1",
                params![id, position as i64, now],
            )
            .map_err(db_failed)?;
    }
    let reordered = list_rows(&transaction, owner)?;
    transaction.commit().map_err(db_failed)?;
    Ok(reordered)
}

pub(crate) fn delete_row(
    conn: &Connection,
    owner: &TabOwner,
    id: &str,
) -> Result<(), MessageError> {
    let Some(existing) = find(conn, id)? else {
        return Ok(());
    };
    if !owner.owns(&existing) {
        return Err(reason::refused(TAB_ROW_OWNER));
    }
    conn.execute("DELETE FROM browser_tabs WHERE id = ?1", params![id])
        .map_err(db_failed)?;
    Ok(())
}

pub(crate) fn delete_session_rows(
    conn: &Connection,
    session_id: &str,
) -> Result<usize, MessageError> {
    let transaction = conn.unchecked_transaction().map_err(db_failed)?;
    let deleted = transaction
        .execute(
            "DELETE FROM browser_tabs WHERE session_id = ?1",
            params![session_id],
        )
        .map_err(db_failed)?;
    visit_rows::delete_session_visits(&transaction, session_id).map_err(db_failed)?;
    transaction.commit().map_err(db_failed)?;
    Ok(deleted)
}

pub(crate) fn stale_session_ids(
    conn: &Connection,
    live_session_ids: &[String],
) -> Result<Vec<String>, MessageError> {
    let mut statement = conn
        .prepare(
            "SELECT t.session_id FROM browser_tabs t
             JOIN sessions s ON s.id = t.session_id
             WHERE s.archived_at IS NOT NULL
             UNION
             SELECT v.session_id FROM browser_visits v
             JOIN sessions s ON s.id = v.session_id
             WHERE s.archived_at IS NOT NULL",
        )
        .map_err(db_failed)?;
    let mut stale = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(db_failed)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(db_failed)?;
    for session_id in live_session_ids {
        let archived: Option<bool> = conn
            .query_row(
                "SELECT archived_at IS NOT NULL FROM sessions WHERE id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(db_failed)?;
        if archived.unwrap_or(true) {
            stale.push(session_id.clone());
        }
    }
    stale.sort();
    stale.dedup();
    Ok(stale)
}

pub(crate) fn pin_row(
    conn: &Connection,
    args: &MoveArgs,
    now: i64,
) -> Result<TabRow, MessageError> {
    let session = TabOwner::Session {
        session_id: args.session_id.clone(),
    };
    let project = TabOwner::Project {
        project_id: args.project_id.clone(),
    };
    let transaction = conn.unchecked_transaction().map_err(db_failed)?;
    let existing = require(&transaction, &args.id)?;
    if project.owns(&existing) {
        return Ok(existing);
    }
    if !session.owns(&existing) {
        return Err(reason::refused(TAB_ROW_OWNER));
    }
    let position = next_position(&transaction, &project)?;
    transaction
        .execute(
            "UPDATE browser_tabs SET session_id = NULL, project_id = ?2, position = ?3, updated_at = ?4 WHERE id = ?1",
            params![args.id, args.project_id, position, now],
        )
        .map_err(db_failed)?;
    let pinned = require(&transaction, &args.id)?;
    transaction.commit().map_err(db_failed)?;
    Ok(pinned)
}

pub(crate) fn unpin_row(
    conn: &Connection,
    args: &MoveArgs,
    now: i64,
) -> Result<TabRow, MessageError> {
    let session = TabOwner::Session {
        session_id: args.session_id.clone(),
    };
    let project = TabOwner::Project {
        project_id: args.project_id.clone(),
    };
    let transaction = conn.unchecked_transaction().map_err(db_failed)?;
    let existing = require(&transaction, &args.id)?;
    if session.owns(&existing) {
        return Ok(existing);
    }
    if !project.owns(&existing) {
        return Err(reason::refused(TAB_ROW_OWNER));
    }
    let position = next_position(&transaction, &session)?;
    transaction
        .execute(
            "UPDATE browser_tabs SET project_id = NULL, session_id = ?2, position = ?3, updated_at = ?4 WHERE id = ?1",
            params![args.id, args.session_id, position, now],
        )
        .map_err(db_failed)?;
    let unpinned = require(&transaction, &args.id)?;
    transaction.commit().map_err(db_failed)?;
    Ok(unpinned)
}

fn connection<'a>(
    state: &'a State<'_, Db>,
) -> Result<std::sync::MutexGuard<'a, Connection>, MessageError> {
    state.0.lock().map_err(|_| reason::failed(TAB_ROWS_FAILED))
}

#[tauri::command]
pub async fn browser_tab_rows_list(
    state: State<'_, Db>,
    args: OwnerArgs,
) -> Result<Vec<TabRow>, MessageError> {
    let conn = connection(&state)?;
    list_rows(&conn, &args.owner)
}

#[tauri::command]
pub async fn browser_workspace_tab_rows_list(
    state: State<'_, Db>,
    args: WorkspaceRowsArgs,
) -> Result<Vec<TabRow>, MessageError> {
    let conn = connection(&state)?;
    list_workspace_rows(&conn, &args.workspace_id)
}

#[tauri::command]
pub async fn browser_tab_row_save(
    app: AppHandle,
    state: State<'_, Db>,
    args: SaveArgs,
) -> Result<TabRow, MessageError> {
    let origins = AppOrigins::of_app(&app);
    let conn = connection(&state)?;
    save_row(&conn, &origins, &args, now_ms())
}

#[tauri::command]
pub async fn browser_tab_rows_reorder(
    state: State<'_, Db>,
    args: ReorderArgs,
) -> Result<Vec<TabRow>, MessageError> {
    let conn = connection(&state)?;
    reorder_rows(&conn, &args.owner, &args.ids, now_ms())
}

#[tauri::command]
pub async fn browser_tab_row_delete(
    state: State<'_, Db>,
    args: DeleteArgs,
) -> Result<(), MessageError> {
    let conn = connection(&state)?;
    delete_row(&conn, &args.owner, &args.id)
}

#[tauri::command]
pub async fn browser_session_tab_rows_delete(
    state: State<'_, Db>,
    args: SessionRowsArgs,
) -> Result<usize, MessageError> {
    let conn = connection(&state)?;
    delete_session_rows(&conn, &args.session_id)
}

#[tauri::command]
pub async fn browser_stale_tab_sessions(
    state: State<'_, Db>,
    registry: State<'_, BrowserRegistry>,
) -> Result<Vec<String>, MessageError> {
    let live = registry.session_ids();
    let conn = connection(&state)?;
    stale_session_ids(&conn, &live)
}

#[tauri::command]
pub async fn browser_tab_row_pin(
    state: State<'_, Db>,
    args: MoveArgs,
) -> Result<TabRow, MessageError> {
    let conn = connection(&state)?;
    pin_row(&conn, &args, now_ms())
}

#[tauri::command]
pub async fn browser_tab_row_unpin(
    state: State<'_, Db>,
    args: MoveArgs,
) -> Result<TabRow, MessageError> {
    let conn = connection(&state)?;
    unpin_row(&conn, &args, now_ms())
}

#[cfg(test)]
mod tests;
