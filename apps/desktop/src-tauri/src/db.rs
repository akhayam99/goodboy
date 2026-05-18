use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number};
use tauri::State;
use thiserror::Error;

const APP_DIR: &str = ".kay-am";
const DB_FILE: &str = "data.db";

#[derive(Debug, Error)]
pub enum DbError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("home directory not available")]
    NoHomeDir,
    #[error("failed to create app directory: {0}")]
    AppDir(#[from] std::io::Error),
    #[error("connection mutex poisoned")]
    Poisoned,
}

impl Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = Map::new();
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

impl DbError {
    fn kind(&self) -> &'static str {
        match self {
            DbError::Sqlite(_) => "sqlite",
            DbError::NoHomeDir => "no_home_dir",
            DbError::AppDir(_) => "app_dir",
            DbError::Poisoned => "poisoned",
        }
    }
}

pub struct Db(pub Mutex<Connection>);

pub fn open() -> Result<Db, DbError> {
    let path = resolve_db_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    Ok(Db(Mutex::new(conn)))
}

fn resolve_db_path() -> Result<PathBuf, DbError> {
    let home = dirs::home_dir().ok_or(DbError::NoHomeDir)?;
    Ok(home.join(APP_DIR).join(DB_FILE))
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum SqlParam {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
}

impl SqlParam {
    fn to_value(&self) -> Value {
        match self {
            SqlParam::Null => Value::Null,
            SqlParam::Bool(b) => Value::Integer(if *b { 1 } else { 0 }),
            SqlParam::Int(n) => Value::Integer(*n),
            SqlParam::Float(f) => Value::Real(*f),
            SqlParam::Text(s) => Value::Text(s.clone()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ExecResult {
    pub rows_affected: i64,
}

#[tauri::command]
pub fn db_exec(state: State<'_, Db>, sql: String) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    conn.execute_batch(&sql)?;
    Ok(())
}

#[tauri::command]
pub fn db_execute(
    state: State<'_, Db>,
    sql: String,
    params: Option<Vec<SqlParam>>,
) -> Result<ExecResult, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(&sql)?;
    let bound = params.unwrap_or_default();
    let values: Vec<Value> = bound.iter().map(SqlParam::to_value).collect();
    let rows_affected = stmt.execute(params_from_iter(values.iter()))? as i64;
    Ok(ExecResult { rows_affected })
}

#[tauri::command]
pub fn db_wipe(state: State<'_, Db>) -> Result<(), DbError> {
    // Drop every user table + schema_version so the next runDbMigrations call
    // replays the chain from m001. Done in-place via SQL so the TS side
    // doesn't need to know the file path or close the connection.
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let table_names: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        rows.collect::<Result<Vec<_>, _>>()?
    };
    conn.execute_batch("PRAGMA foreign_keys = OFF;")?;
    for name in &table_names {
        // Identifiers can't be parameterised; names come from sqlite_master and
        // are always valid SQL identifiers, so direct interpolation is safe.
        conn.execute_batch(&format!("DROP TABLE IF EXISTS \"{}\";", name))?;
    }
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(())
}

#[tauri::command]
pub fn db_select(
    state: State<'_, Db>,
    sql: String,
    params: Option<Vec<SqlParam>>,
) -> Result<Vec<Map<String, serde_json::Value>>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(&sql)?;
    let bound = params.unwrap_or_default();
    let values: Vec<Value> = bound.iter().map(SqlParam::to_value).collect();
    let column_names: Vec<String> = stmt.column_names().into_iter().map(String::from).collect();

    let mut rows = stmt.query(params_from_iter(values.iter()))?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        let mut record = Map::new();
        for (idx, name) in column_names.iter().enumerate() {
            record.insert(name.clone(), value_to_json(row.get_ref(idx)?));
        }
        out.push(record);
    }
    Ok(out)
}

fn value_to_json(value: ValueRef<'_>) -> serde_json::Value {
    match value {
        ValueRef::Null => serde_json::Value::Null,
        ValueRef::Integer(n) => serde_json::Value::Number(Number::from(n)),
        ValueRef::Real(f) => Number::from_f64(f)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        ValueRef::Text(bytes) => serde_json::Value::String(
            std::str::from_utf8(bytes)
                .map(String::from)
                .unwrap_or_default(),
        ),
        ValueRef::Blob(bytes) => serde_json::Value::String(format!("blob:{}", bytes.len())),
    }
}

fn query_rows(
    conn: &Connection,
    sql: &str,
    params: &[&dyn rusqlite::ToSql],
) -> Result<Vec<Map<String, serde_json::Value>>, rusqlite::Error> {
    let mut stmt = conn.prepare(sql)?;
    let column_names: Vec<String> = stmt.column_names().into_iter().map(String::from).collect();
    let mut rows = stmt.query(params)?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        let mut record = Map::new();
        for (idx, name) in column_names.iter().enumerate() {
            record.insert(name.clone(), value_to_json(row.get_ref(idx)?));
        }
        out.push(record);
    }
    Ok(out)
}

#[derive(Debug, Serialize)]
pub struct SessionHydration {
    agents: Vec<Map<String, serde_json::Value>>,
    agent_run_ids: Vec<Map<String, serde_json::Value>>,
    telemetry_summary: Map<String, serde_json::Value>,
    slots: Vec<Map<String, serde_json::Value>>,
}

#[tauri::command]
pub fn session_hydrate(
    state: State<'_, Db>,
    session_id: String,
) -> Result<SessionHydration, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let sid: &dyn rusqlite::ToSql = &session_id;

    let agents = query_rows(
        &conn,
        "SELECT id, session_id AS \"sessionId\", step_id AS \"stepId\", ordinal, name, status,
                provider_run_id AS \"providerRunId\", output_summary AS \"outputSummary\",
                started_at AS \"startedAt\", completed_at AS \"completedAt\",
                provider_session_id AS \"providerSessionId\",
                last_finished_at AS \"lastFinishedAt\", last_viewed_at AS \"lastViewedAt\"
         FROM agents WHERE session_id = ?1 ORDER BY ordinal ASC",
        &[sid],
    )?;

    let agent_run_ids = query_rows(
        &conn,
        "SELECT agent_id, GROUP_CONCAT(DISTINCT run_id) AS run_ids
         FROM (
           SELECT agent_id, json_extract(payload, '$.runId') AS run_id
           FROM turn_events
           WHERE session_id = ?1
             AND json_extract(payload, '$.runId') IS NOT NULL
             AND json_extract(payload, '$.runId') != 'history'
         )
         GROUP BY agent_id",
        &[sid],
    )?;

    let telemetry_summary = {
        let rows = query_rows(
            &conn,
            "SELECT COALESCE(SUM(input_tokens), 0) AS input,
                    COALESCE(SUM(output_tokens), 0) AS output,
                    COALESCE(SUM(estimated_cost_usd), 0) AS cost,
                    COUNT(*) AS count
             FROM telemetry_records WHERE session_id = ?1",
            &[sid],
        )?;
        rows.into_iter().next().unwrap_or_default()
    };

    let slots = query_rows(
        &conn,
        "SELECT * FROM context_slots WHERE session_id = ?1 ORDER BY key",
        &[sid],
    )?;

    Ok(SessionHydration {
        agents,
        agent_run_ids,
        telemetry_summary,
        slots,
    })
}
