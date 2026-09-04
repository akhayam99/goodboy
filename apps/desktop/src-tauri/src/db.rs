use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number};
use tauri::State;
use thiserror::Error;

const APP_DIR: &str = ".goodboy";
const DB_FILE: &str = "data.db";
const DB_FILE_DEV: &str = "data.dev.db";

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
    #[error("invalid migration snapshot path")]
    InvalidSnapshotPath,
    #[error("migration snapshot filesystem error: {0}")]
    MigrationSnapshotFilesystem(String),
}

crate::util::impl_error_serialize!(DbError);

impl DbError {
    fn kind(&self) -> &'static str {
        match self {
            DbError::Sqlite(_) => "sqlite",
            DbError::NoHomeDir => "no_home_dir",
            DbError::AppDir(_) => "app_dir",
            DbError::Poisoned => "poisoned",
            DbError::InvalidSnapshotPath => "invalid_snapshot_path",
            DbError::MigrationSnapshotFilesystem(_) => "migration_snapshot_filesystem",
        }
    }
}

pub struct Db(pub Mutex<Connection>, pub PathBuf);

pub fn open() -> Result<Db, DbError> {
    let path = resolve_db_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    Ok(Db(Mutex::new(conn), path))
}

#[tauri::command]
pub fn db_path(state: State<'_, Db>) -> String {
    state.1.to_string_lossy().into_owned()
}

fn migration_snapshot_prefix(path: &std::path::Path) -> String {
    format!(
        "{}.pre-m",
        path.file_name().unwrap_or_default().to_string_lossy()
    )
}

#[tauri::command]
pub async fn db_list_migration_snapshots(state: State<'_, Db>) -> Result<Vec<String>, DbError> {
    let db_path = state.1.clone();
    tauri::async_runtime::spawn_blocking(move || db_list_migration_snapshots_blocking(db_path))
        .await
        .map_err(|e| DbError::MigrationSnapshotFilesystem(e.to_string()))?
}

fn db_list_migration_snapshots_blocking(db_path: PathBuf) -> Result<Vec<String>, DbError> {
    let Some(parent) = db_path.parent() else {
        return Ok(Vec::new());
    };
    let prefix = migration_snapshot_prefix(&db_path);
    let mut snapshots = Vec::new();
    let entries = std::fs::read_dir(parent)
        .map_err(|error| DbError::MigrationSnapshotFilesystem(error.to_string()))?;
    for entry in entries {
        let path = entry
            .map_err(|error| DbError::MigrationSnapshotFilesystem(error.to_string()))?
            .path();
        let name = path.file_name().unwrap_or_default().to_string_lossy();
        if name.starts_with(&prefix) && name.ends_with(".bak") {
            snapshots.push(path.to_string_lossy().into_owned());
        }
    }
    Ok(snapshots)
}

#[tauri::command]
pub async fn db_remove_migration_snapshot(
    state: State<'_, Db>,
    path: String,
) -> Result<(), DbError> {
    let db_path = state.1.clone();
    tauri::async_runtime::spawn_blocking(move || {
        db_remove_migration_snapshot_blocking(db_path, path)
    })
    .await
    .map_err(|e| DbError::MigrationSnapshotFilesystem(e.to_string()))?
}

fn db_remove_migration_snapshot_blocking(db_path: PathBuf, path: String) -> Result<(), DbError> {
    let snapshot_path = PathBuf::from(path);
    let name = snapshot_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    let is_same_parent = snapshot_path.parent() == db_path.parent();
    let is_snapshot =
        name.starts_with(&migration_snapshot_prefix(&db_path)) && name.ends_with(".bak");
    if !is_same_parent || !is_snapshot {
        return Err(DbError::InvalidSnapshotPath);
    }
    std::fs::remove_file(snapshot_path)
        .map_err(|error| DbError::MigrationSnapshotFilesystem(error.to_string()))?;
    Ok(())
}

/// Resolves the SQLite file. Precedence:
///   1. `GOODBOY_DB_FILE` env (absolute path verbatim, relative under `~/.goodboy`).
///   2. Debug builds (`pnpm tauri dev`) -> `data.dev.db`, a private playground.
///   3. Release builds (the shipped app) -> `data.db`, the production file.
/// Splitting on `debug_assertions` keeps local experiments off the prod DB
/// automatically, with no env setup required.
pub fn resolve_db_path() -> Result<PathBuf, DbError> {
    let home = dirs::home_dir().ok_or(DbError::NoHomeDir)?;
    let dir = home.join(APP_DIR);

    if let Ok(custom) = std::env::var("GOODBOY_DB_FILE") {
        let custom = custom.trim();
        if !custom.is_empty() {
            let p = PathBuf::from(custom);
            return Ok(if p.is_absolute() { p } else { dir.join(p) });
        }
    }

    let file = if cfg!(debug_assertions) {
        DB_FILE_DEV
    } else {
        DB_FILE
    };
    Ok(dir.join(file))
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

#[tauri::command(async)]
pub fn db_exec(state: State<'_, Db>, sql: String) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    conn.execute_batch(&sql)?;
    Ok(())
}

#[tauri::command(async)]
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

#[tauri::command(async)]
pub fn db_wipe(state: State<'_, Db>) -> Result<(), DbError> {
    // Drop every user table + schema_version so the next runDbMigrations call
    // replays the chain from m001. Done in-place via SQL so the TS side
    // doesn't need to know the file path or close the connection.
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let table_names: Vec<String> = {
        let mut stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )?;
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

#[tauri::command(async)]
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

pub fn value_to_json(value: ValueRef<'_>) -> serde_json::Value {
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
