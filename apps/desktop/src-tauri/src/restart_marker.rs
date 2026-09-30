use crate::util::MessageError;
use rusqlite::Connection;
use serde::Serialize;

pub const INTERRUPTED_RUNS_KEY: &str = "restart.interrupted_runs";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InterruptedRuns<'a> {
    run_ids: &'a [String],
    at: i64,
}

pub fn record(conn: &Connection, run_ids: &[String], at_ms: i64) -> rusqlite::Result<()> {
    if run_ids.is_empty() {
        return Ok(());
    }
    let value = serde_json::to_string(&InterruptedRuns { run_ids, at: at_ms })
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        rusqlite::params![INTERRUPTED_RUNS_KEY, value, at_ms],
    )?;
    Ok(())
}

pub fn persist(app: &tauri::AppHandle, run_ids: &[String]) {
    use tauri::Manager;
    if run_ids.is_empty() {
        return;
    }
    let Some(database) = app.try_state::<crate::db::Db>() else {
        return;
    };
    let Ok(conn) = database.0.lock() else {
        return;
    };
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0);
    if let Err(error) = record(&conn, run_ids, now_ms) {
        log::warn!(
            "[goodboy] could not record the interrupted runs: {}",
            crate::logging::detail(&error)
        );
    }
}

#[tauri::command]
pub async fn restart_prepare(app: tauri::AppHandle) -> Result<Vec<String>, MessageError> {
    tauri::async_runtime::spawn_blocking(move || restart_prepare_blocking(&app))
        .await
        .map_err(|e| MessageError::Failed(e.to_string()))
}

fn restart_prepare_blocking(app: &tauri::AppHandle) -> Vec<String> {
    use tauri::Manager;
    let interrupted = crate::turn::live_run_ids(&app.state::<crate::turn::TurnRegistry>());
    crate::drain_child_processes(app, true);
    interrupted
}

#[tauri::command]
pub fn restart_abort() {
    crate::turn::clear_exiting();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);",
        )
        .unwrap();
        conn
    }

    fn stored(conn: &Connection) -> Option<String> {
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [INTERRUPTED_RUNS_KEY],
            |row| row.get(0),
        )
        .ok()
    }

    #[test]
    fn records_the_interrupted_run_ids() {
        let conn = settings_db();
        record(&conn, &["run-a".to_string(), "run-b".to_string()], 42).unwrap();
        assert_eq!(
            stored(&conn).as_deref(),
            Some(r#"{"runIds":["run-a","run-b"],"at":42}"#)
        );
    }

    #[test]
    fn an_empty_exit_keeps_the_previous_marker() {
        let conn = settings_db();
        record(&conn, &["run-a".to_string()], 1).unwrap();
        record(&conn, &[], 2).unwrap();
        assert_eq!(
            stored(&conn).as_deref(),
            Some(r#"{"runIds":["run-a"],"at":1}"#)
        );
    }

    #[test]
    fn a_later_exit_replaces_the_marker() {
        let conn = settings_db();
        record(&conn, &["run-a".to_string()], 1).unwrap();
        record(&conn, &["run-b".to_string()], 2).unwrap();
        assert_eq!(
            stored(&conn).as_deref(),
            Some(r#"{"runIds":["run-b"],"at":2}"#)
        );
    }
}
