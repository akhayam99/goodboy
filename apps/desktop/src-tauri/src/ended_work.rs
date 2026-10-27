use rusqlite::Connection;
use serde::Serialize;

pub const ENDED_WORK_KEY: &str = "restart.ended_work";

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EndedTerminal {
    pub id: String,
    pub command: String,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EndedScript {
    pub script_id: String,
    pub session_id: String,
    pub name: String,
    pub cwd: String,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EndedWork {
    pub at: i64,
    pub terminals: Vec<EndedTerminal>,
    pub scripts: Vec<EndedScript>,
}

impl EndedWork {
    pub fn is_empty(&self) -> bool {
        self.terminals.is_empty() && self.scripts.is_empty()
    }
}

pub fn record(conn: &Connection, work: &EndedWork) -> rusqlite::Result<()> {
    if work.is_empty() {
        return Ok(());
    }
    let value = serde_json::to_string(work)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
    crate::restart_marker::write_setting(conn, ENDED_WORK_KEY, &value, work.at)
}

pub fn persist(app: &tauri::AppHandle) {
    use tauri::Manager;
    let work = EndedWork {
        at: crate::util::now_ms(),
        terminals: app
            .state::<crate::terminal::TerminalRegistry>()
            .ended_terminals(),
        scripts: app
            .state::<crate::scripts::ScriptRegistry>()
            .ended_scripts(),
    };
    if work.is_empty() {
        return;
    }
    let Some(database) = app.try_state::<crate::db::Db>() else {
        return;
    };
    let Ok(conn) = database.0.lock() else {
        return;
    };
    if let Err(error) = record(&conn, &work) {
        log::warn!(
            "[goodboy] could not record the work that ended with the app: {}",
            crate::logging::detail(&error)
        );
    }
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
            [ENDED_WORK_KEY],
            |row| row.get(0),
        )
        .ok()
    }

    fn work(at: i64, terminals: Vec<EndedTerminal>, scripts: Vec<EndedScript>) -> EndedWork {
        EndedWork {
            at,
            terminals,
            scripts,
        }
    }

    fn dev_terminal() -> EndedTerminal {
        EndedTerminal {
            id: "session-1::t2".to_string(),
            command: "node /usr/local/lib/pnpm.cjs dev".to_string(),
        }
    }

    fn api_script() -> EndedScript {
        EndedScript {
            script_id: "script-api".to_string(),
            session_id: "session-1".to_string(),
            name: "api".to_string(),
            cwd: "/work/payments-api".to_string(),
        }
    }

    #[test]
    fn records_the_terminals_and_services_that_ended_with_the_app() {
        let conn = settings_db();
        record(&conn, &work(42, vec![dev_terminal()], vec![api_script()])).unwrap();
        assert_eq!(
            stored(&conn).as_deref(),
            Some(
                r#"{"at":42,"terminals":[{"id":"session-1::t2","command":"node /usr/local/lib/pnpm.cjs dev"}],"scripts":[{"scriptId":"script-api","sessionId":"session-1","name":"api","cwd":"/work/payments-api"}]}"#
            )
        );
    }

    #[test]
    fn an_exit_with_nothing_running_keeps_the_previous_record() {
        let conn = settings_db();
        record(&conn, &work(1, vec![], vec![api_script()])).unwrap();
        record(&conn, &work(2, vec![], vec![])).unwrap();
        assert!(stored(&conn).unwrap().contains(r#""at":1"#));
    }

    #[test]
    fn a_later_exit_replaces_the_record() {
        let conn = settings_db();
        record(&conn, &work(1, vec![], vec![api_script()])).unwrap();
        record(&conn, &work(2, vec![dev_terminal()], vec![])).unwrap();
        let value = stored(&conn).unwrap();
        assert!(value.contains(r#""at":2"#));
        assert!(!value.contains("script-api"));
    }
}
