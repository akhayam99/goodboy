use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, State};

use super::guard::{self, AppOrigins};
use super::reason::{self, VISITS_FAILED};
use crate::db::Db;
use crate::util::{lock_or_recover, now_ms, uuid_v4, MessageError};

const MAX_ADDRESS_BYTES: usize = 8192;
const MAX_TITLE_CHARS: usize = 512;
pub(crate) const MAX_VISITS_PER_SESSION: i64 = 200;
pub(crate) const LISTED_VISITS: i64 = 20;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VisitRow {
    pub(crate) url: String,
    pub(crate) title: String,
    pub(crate) visited_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ListArgs {
    session_id: String,
}

fn db_failed(error: rusqlite::Error) -> MessageError {
    log::warn!("[browser] visits_failed reason={error}");
    reason::failed(VISITS_FAILED)
}

fn read_row(row: &Row) -> rusqlite::Result<VisitRow> {
    Ok(VisitRow {
        url: row.get(0)?,
        title: row.get(1)?,
        visited_at: row.get(2)?,
    })
}

pub(crate) fn visitable_address(address: &str, origins: &AppOrigins) -> Option<String> {
    if address.len() > MAX_ADDRESS_BYTES {
        return None;
    }
    let mut url = guard::parse_address(address)?;
    if !guard::is_web_address(&url, origins) {
        return None;
    }
    let _ = url.set_username("");
    let _ = url.set_password(None);
    url.set_fragment(None);
    Some(url.to_string())
}

fn storable_title(title: &str) -> String {
    title.trim().chars().take(MAX_TITLE_CHARS).collect()
}

pub(crate) fn record_visit(
    conn: &Connection,
    session_id: &str,
    url: &str,
    title: &str,
    now: i64,
) -> Result<(), MessageError> {
    let title = storable_title(title);
    let transaction = conn.unchecked_transaction().map_err(db_failed)?;
    transaction
        .execute(
            "INSERT INTO browser_visits (id, session_id, url, title, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)
             ON CONFLICT (session_id, url) DO UPDATE SET
               updated_at = excluded.updated_at,
               title = CASE WHEN excluded.title = '' THEN browser_visits.title ELSE excluded.title END",
            params![uuid_v4(), session_id, url, title, now],
        )
        .map_err(db_failed)?;
    transaction
        .execute(
            "DELETE FROM browser_visits WHERE session_id = ?1 AND id NOT IN (
               SELECT id FROM browser_visits WHERE session_id = ?1
               ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT ?2
             )",
            params![session_id, MAX_VISITS_PER_SESSION],
        )
        .map_err(db_failed)?;
    transaction.commit().map_err(db_failed)?;
    Ok(())
}

pub(crate) fn retitle_visit(
    conn: &Connection,
    session_id: &str,
    url: &str,
    title: &str,
) -> Result<usize, MessageError> {
    let title = storable_title(title);
    if title.is_empty() {
        return Ok(0);
    }
    conn.execute(
        "UPDATE browser_visits SET title = ?3 WHERE session_id = ?1 AND url = ?2",
        params![session_id, url, title],
    )
    .map_err(db_failed)
}

pub(crate) fn list_visits(
    conn: &Connection,
    session_id: &str,
    limit: i64,
) -> Result<Vec<VisitRow>, MessageError> {
    let mut statement = conn
        .prepare(
            "SELECT url, title, updated_at FROM browser_visits WHERE session_id = ?1
             ORDER BY updated_at DESC, created_at DESC, id DESC LIMIT ?2",
        )
        .map_err(db_failed)?;
    let rows = statement
        .query_map(params![session_id, limit], read_row)
        .map_err(db_failed)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(db_failed)?;
    Ok(rows)
}

pub(crate) fn delete_session_visits(
    conn: &Connection,
    session_id: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "DELETE FROM browser_visits WHERE session_id = ?1",
        params![session_id],
    )
}

pub(crate) fn save_visit<R: Runtime>(app: &AppHandle<R>, session_id: &str, url: &str, title: &str) {
    let Some(url) = visitable_address(url, &AppOrigins::of_app(app)) else {
        return;
    };
    let app = app.clone();
    let session_id = session_id.to_string();
    let title = title.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let Some(db) = app.try_state::<Db>() else {
            return;
        };
        let conn = lock_or_recover(&db.0);
        let _ = record_visit(&conn, &session_id, &url, &title, now_ms());
    });
}

pub(crate) fn save_visit_title<R: Runtime>(
    app: &AppHandle<R>,
    session_id: &str,
    url: &str,
    title: &str,
) {
    let Some(url) = visitable_address(url, &AppOrigins::of_app(app)) else {
        return;
    };
    let app = app.clone();
    let session_id = session_id.to_string();
    let title = title.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let Some(db) = app.try_state::<Db>() else {
            return;
        };
        let conn = lock_or_recover(&db.0);
        let _ = retitle_visit(&conn, &session_id, &url, &title);
    });
}

#[tauri::command]
pub async fn browser_visits_list(
    state: State<'_, Db>,
    args: ListArgs,
) -> Result<Vec<VisitRow>, MessageError> {
    let conn = state.0.lock().map_err(|_| reason::failed(VISITS_FAILED))?;
    list_visits(&conn, &args.session_id, LISTED_VISITS)
}

#[cfg(test)]
mod tests;
