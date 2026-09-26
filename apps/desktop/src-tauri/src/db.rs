use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::config::DbConfig;
use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection, Statement, TransactionBehavior};
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
    #[error("statement {0} has a guard without an abort code")]
    GuardWithoutAbortCode(usize),
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
            DbError::GuardWithoutAbortCode(_) => "guard_without_abort_code",
        }
    }
}

pub struct Db(pub Mutex<Connection>, pub PathBuf);

pub fn open() -> Result<Db, DbError> {
    let path = resolve_db_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = open_and_finish_wipe(&path)?;
    Ok(Db(Mutex::new(conn), path))
}

const CORE_TABLES: [&str; 3] = ["schema_version", "sessions", "agents"];

fn open_and_finish_wipe(path: &std::path::Path) -> Result<Connection, DbError> {
    let conn = open_connection(path)?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default();
    match finish_interrupted_wipe(&conn, path, stamp) {
        Ok(Some(backup)) => eprintln!(
            "[goodboy] finished an interrupted wipe of the local database, copy kept at {}",
            backup.display()
        ),
        Ok(None) => {}
        Err(error) => eprintln!("[goodboy] left a possibly half-wiped database untouched: {error}"),
    }
    Ok(conn)
}

fn misses_a_core_table(conn: &Connection) -> Result<bool, DbError> {
    for table in CORE_TABLES {
        let found: i64 = conn.query_row(
            "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
            [table],
            |row| row.get(0),
        )?;
        if found == 0 {
            return Ok(true);
        }
    }
    Ok(false)
}

fn back_up_before_reset(
    conn: &Connection,
    path: &std::path::Path,
    stamp: u64,
) -> Result<PathBuf, DbError> {
    conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))?;
    let backup = with_suffix(path, &format!(".pre-reset-{stamp}.bak"));
    let copy = |from: &std::path::Path, to: &std::path::Path| {
        std::fs::copy(from, to)
            .map(|_| ())
            .map_err(|error| DbError::MigrationSnapshotFilesystem(error.to_string()))
    };
    copy(path, &backup)?;
    for suffix in ["-wal", "-shm"] {
        let source = with_suffix(path, suffix);
        if source.exists() {
            copy(&source, &with_suffix(&backup, suffix))?;
        }
    }
    Ok(backup)
}

fn has_stranded_view(conn: &Connection) -> Result<bool, DbError> {
    let views: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type = 'view'")?
        .query_map([], |row| row.get(0))?
        .collect::<Result<_, _>>()?;
    Ok(views.iter().any(|name| {
        let probe = format!("SELECT * FROM \"{}\" LIMIT 0", name.replace('"', "\"\""));
        match conn.prepare(&probe) {
            Ok(_) => false,
            Err(error) => error.to_string().contains("no such table"),
        }
    }))
}

fn finish_interrupted_wipe(
    conn: &Connection,
    path: &std::path::Path,
    stamp: u64,
) -> Result<Option<PathBuf>, DbError> {
    if !has_stranded_view(conn)? || !misses_a_core_table(conn)? {
        return Ok(None);
    }
    let backup = back_up_before_reset(conn, path, stamp)?;
    reset_database(conn)?;
    Ok(Some(backup))
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

pub(crate) fn db_list_migration_snapshots_blocking(
    db_path: PathBuf,
) -> Result<Vec<String>, DbError> {
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

fn validated_snapshot_path(db_path: &std::path::Path, path: String) -> Result<PathBuf, DbError> {
    let snapshot_path = PathBuf::from(path);
    let name = snapshot_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    let is_same_parent = snapshot_path.parent() == db_path.parent();
    let is_snapshot =
        name.starts_with(&migration_snapshot_prefix(db_path)) && name.ends_with(".bak");
    if !is_same_parent || !is_snapshot {
        return Err(DbError::InvalidSnapshotPath);
    }
    Ok(snapshot_path)
}

fn db_remove_migration_snapshot_blocking(db_path: PathBuf, path: String) -> Result<(), DbError> {
    let snapshot_path = validated_snapshot_path(&db_path, path)?;
    std::fs::remove_file(snapshot_path)
        .map_err(|error| DbError::MigrationSnapshotFilesystem(error.to_string()))?;
    Ok(())
}

fn open_connection(path: &std::path::Path) -> Result<Connection, DbError> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    Ok(conn)
}

fn with_suffix(path: &std::path::Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

fn move_if_present(from: &std::path::Path, to: &std::path::Path) -> Result<(), DbError> {
    if !from.exists() {
        return Ok(());
    }
    std::fs::rename(from, to)
        .map_err(|error| DbError::MigrationSnapshotFilesystem(error.to_string()))
}

fn swap_in_snapshot(
    db_path: &std::path::Path,
    snapshot_path: &std::path::Path,
    stamp: u128,
) -> Result<PathBuf, DbError> {
    let kept_path = with_suffix(db_path, &format!(".newer-build-{stamp}.bak"));
    move_if_present(db_path, &kept_path)?;
    for suffix in ["-wal", "-shm"] {
        move_if_present(
            &with_suffix(db_path, suffix),
            &with_suffix(&kept_path, suffix),
        )?;
    }
    std::fs::copy(snapshot_path, db_path)
        .map_err(|error| DbError::MigrationSnapshotFilesystem(error.to_string()))?;
    Ok(kept_path)
}

fn restore_migration_snapshot(
    conn: &mut Connection,
    db_path: &std::path::Path,
    path: String,
    stamp: u128,
) -> Result<String, DbError> {
    let snapshot_path = validated_snapshot_path(db_path, path)?;
    if !snapshot_path.is_file() {
        return Err(DbError::InvalidSnapshotPath);
    }
    let previous = std::mem::replace(conn, Connection::open_in_memory()?);
    previous.close().map_err(|(_, error)| DbError::Sqlite(error))?;
    let swapped = swap_in_snapshot(db_path, &snapshot_path, stamp);
    *conn = open_connection(db_path)?;
    Ok(swapped?.to_string_lossy().into_owned())
}

#[tauri::command(async)]
pub fn db_restore_migration_snapshot(
    state: State<'_, Db>,
    path: String,
) -> Result<String, DbError> {
    let mut conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis())
        .unwrap_or_default();
    restore_migration_snapshot(&mut conn, &state.1, path, stamp)
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
#[serde(rename_all = "camelCase")]
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

pub(crate) fn reset_database(conn: &Connection) -> Result<(), DbError> {
    let _ = conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()));
    conn.set_db_config(DbConfig::SQLITE_DBCONFIG_RESET_DATABASE, true)?;
    let vacuumed = conn.execute_batch("VACUUM;");
    conn.set_db_config(DbConfig::SQLITE_DBCONFIG_RESET_DATABASE, false)?;
    vacuumed?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    Ok(())
}

#[tauri::command(async)]
pub fn db_wipe(app: tauri::AppHandle, state: State<'_, Db>) -> Result<(), DbError> {
    crate::stop_running_work(&app);
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    reset_database(&conn)
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
    Ok(collect_rows(&mut stmt, &bound)?)
}

fn collect_rows(
    stmt: &mut Statement<'_>,
    params: &[SqlParam],
) -> Result<Vec<Map<String, serde_json::Value>>, rusqlite::Error> {
    let values: Vec<Value> = params.iter().map(SqlParam::to_value).collect();
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

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StatementGuard {
    Rows,
    NoRows,
    NoChanges,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TxStatement {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<SqlParam>,
    #[serde(default)]
    pub abort_when: Option<StatementGuard>,
    #[serde(default)]
    pub abort_code: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TxStatementResult {
    pub rows_affected: i64,
    pub rows: Vec<Map<String, serde_json::Value>>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum TxOutcome {
    Committed {
        results: Vec<TxStatementResult>,
    },
    #[serde(rename_all = "camelCase")]
    Aborted {
        abort_code: String,
        index: usize,
    },
}

fn run_statement(
    conn: &Connection,
    statement: &TxStatement,
) -> Result<TxStatementResult, rusqlite::Error> {
    let mut stmt = conn.prepare(&statement.sql)?;
    let is_readonly = stmt.readonly();
    let rows = collect_rows(&mut stmt, &statement.params)?;
    let rows_affected = if is_readonly {
        0
    } else {
        conn.changes() as i64
    };
    Ok(TxStatementResult {
        rows_affected,
        rows,
    })
}

fn guard_trips(guard: StatementGuard, result: &TxStatementResult) -> bool {
    match guard {
        StatementGuard::Rows => !result.rows.is_empty(),
        StatementGuard::NoRows => result.rows.is_empty(),
        StatementGuard::NoChanges => result.rows_affected == 0,
    }
}

pub fn run_transaction(
    conn: &mut Connection,
    statements: &[TxStatement],
) -> Result<TxOutcome, DbError> {
    if let Some(index) = statements
        .iter()
        .position(|statement| statement.abort_when.is_some() && statement.abort_code.is_none())
    {
        return Err(DbError::GuardWithoutAbortCode(index));
    }
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let mut results = Vec::with_capacity(statements.len());
    for (index, statement) in statements.iter().enumerate() {
        let result = run_statement(&tx, statement)?;
        if let (Some(guard), Some(abort_code)) = (statement.abort_when, &statement.abort_code) {
            if guard_trips(guard, &result) {
                tx.rollback()?;
                return Ok(TxOutcome::Aborted {
                    abort_code: abort_code.clone(),
                    index,
                });
            }
        }
        results.push(result);
    }
    tx.commit()?;
    Ok(TxOutcome::Committed { results })
}

#[tauri::command(async)]
pub fn db_transaction(
    state: State<'_, Db>,
    statements: Vec<TxStatement>,
) -> Result<TxOutcome, DbError> {
    let mut conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    run_transaction(&mut conn, &statements)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exec_result_serializes_rows_affected_in_camel_case() {
        let value = serde_json::to_value(ExecResult { rows_affected: 3 }).unwrap();
        assert_eq!(value, serde_json::json!({ "rowsAffected": 3 }));
    }

    fn memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL);")
            .unwrap();
        conn
    }

    fn statement(sql: &str, params: Vec<SqlParam>) -> TxStatement {
        TxStatement {
            sql: sql.to_string(),
            params,
            abort_when: None,
            abort_code: None,
        }
    }

    fn guarded(sql: &str, params: Vec<SqlParam>, guard: StatementGuard) -> TxStatement {
        TxStatement {
            abort_when: Some(guard),
            abort_code: Some("STALE".to_string()),
            ..statement(sql, params)
        }
    }

    fn insert(id: &str) -> TxStatement {
        statement(
            "INSERT INTO workspaces (id, name) VALUES (?, ?)",
            vec![
                SqlParam::Text(id.to_string()),
                SqlParam::Text("x".to_string()),
            ],
        )
    }

    fn count(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM workspaces", [], |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn commits_every_statement_and_reports_changes() {
        let mut conn = memory_db();
        let outcome = run_transaction(&mut conn, &[insert("a"), insert("b")]).unwrap();
        let TxOutcome::Committed { results } = outcome else {
            panic!("expected a commit");
        };
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].rows_affected, 1);
        assert_eq!(count(&conn), 2);
    }

    #[test]
    fn a_tripped_guard_rolls_back_earlier_writes() {
        let mut conn = memory_db();
        let outcome = run_transaction(
            &mut conn,
            &[
                insert("a"),
                guarded(
                    "UPDATE workspaces SET name = 'y' WHERE id = ?",
                    vec![SqlParam::Text("missing".to_string())],
                    StatementGuard::NoChanges,
                ),
                insert("b"),
            ],
        )
        .unwrap();
        let TxOutcome::Aborted { abort_code, index } = outcome else {
            panic!("expected an abort");
        };
        assert_eq!(abort_code, "STALE");
        assert_eq!(index, 1);
        assert_eq!(count(&conn), 0);
    }

    #[test]
    fn row_guards_trip_on_presence_and_absence() {
        let mut conn = memory_db();
        run_transaction(&mut conn, &[insert("a")]).unwrap();
        let present = run_transaction(
            &mut conn,
            &[guarded(
                "SELECT id FROM workspaces WHERE id = ?",
                vec![SqlParam::Text("a".to_string())],
                StatementGuard::Rows,
            )],
        )
        .unwrap();
        assert!(matches!(present, TxOutcome::Aborted { .. }));
        let absent = run_transaction(
            &mut conn,
            &[guarded(
                "SELECT id FROM workspaces WHERE id = ?",
                vec![SqlParam::Text("z".to_string())],
                StatementGuard::NoRows,
            )],
        )
        .unwrap();
        assert!(matches!(absent, TxOutcome::Aborted { .. }));
    }

    #[test]
    fn a_sql_error_rolls_back_the_batch() {
        let mut conn = memory_db();
        let outcome = run_transaction(&mut conn, &[insert("a"), insert("a")]);
        assert!(outcome.is_err());
        assert_eq!(count(&conn), 0);
    }

    #[test]
    fn selects_inside_a_batch_return_rows_without_changes() {
        let mut conn = memory_db();
        let outcome = run_transaction(
            &mut conn,
            &[
                insert("a"),
                statement("SELECT id, name FROM workspaces", Vec::new()),
            ],
        )
        .unwrap();
        let TxOutcome::Committed { results } = outcome else {
            panic!("expected a commit");
        };
        assert_eq!(results[1].rows_affected, 0);
        assert_eq!(results[1].rows[0].get("id"), Some(&serde_json::json!("a")));
    }

    #[test]
    fn a_guard_without_an_abort_code_is_refused_before_writing() {
        let mut conn = memory_db();
        let mut unguarded = insert("b");
        unguarded.abort_when = Some(StatementGuard::NoChanges);
        let outcome = run_transaction(&mut conn, &[insert("a"), unguarded]);
        assert!(matches!(outcome, Err(DbError::GuardWithoutAbortCode(1))));
        assert_eq!(count(&conn), 0);
    }

    #[test]
    fn outcomes_serialize_with_camel_case_keys() {
        let committed = serde_json::to_value(TxOutcome::Committed {
            results: vec![TxStatementResult {
                rows_affected: 2,
                rows: Vec::new(),
            }],
        })
        .unwrap();
        assert_eq!(
            committed,
            serde_json::json!({ "status": "committed", "results": [{ "rowsAffected": 2, "rows": [] }] })
        );
        let aborted = serde_json::to_value(TxOutcome::Aborted {
            abort_code: "STALE".to_string(),
            index: 1,
        })
        .unwrap();
        assert_eq!(
            aborted,
            serde_json::json!({ "status": "aborted", "abortCode": "STALE", "index": 1 })
        );
    }

    #[test]
    fn statements_deserialize_from_the_client_shape() {
        let parsed: TxStatement = serde_json::from_value(serde_json::json!({
            "sql": "UPDATE workspaces SET name = ?",
            "params": ["y"],
            "abortWhen": "noChanges",
            "abortCode": "STALE"
        }))
        .unwrap();
        assert!(matches!(parsed.abort_when, Some(StatementGuard::NoChanges)));
        assert_eq!(parsed.abort_code.as_deref(), Some("STALE"));
        assert_eq!(parsed.params.len(), 1);
    }

    fn scratch_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-db-restore-{name}-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn marker(conn: &Connection) -> String {
        conn.query_row("SELECT name FROM workspaces", [], |row| row.get(0))
            .unwrap()
    }

    fn seed_marker(conn: &Connection, name: &str) {
        conn.execute_batch("CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL);")
            .unwrap();
        conn.execute(
            "INSERT INTO workspaces (id, name) VALUES (?, ?)",
            ["a", name],
        )
        .unwrap();
    }

    #[test]
    fn restoring_a_snapshot_swaps_the_live_file_and_keeps_the_newer_one() {
        let dir = scratch_dir("swap");
        let db_path = dir.join("data.db");
        let snapshot_path = dir.join("data.db.pre-m9-from-m8-20260901T120000000Z.bak");
        let snapshot = Connection::open(&snapshot_path).unwrap();
        seed_marker(&snapshot, "older");
        drop(snapshot);
        let mut conn = open_connection(&db_path).unwrap();
        seed_marker(&conn, "newer");

        let kept = restore_migration_snapshot(
            &mut conn,
            &db_path,
            snapshot_path.to_string_lossy().into_owned(),
            42,
        )
        .unwrap();

        assert_eq!(marker(&conn), "older");
        assert!(kept.ends_with("data.db.newer-build-42.bak"));
        assert_eq!(marker(&Connection::open(&kept).unwrap()), "newer");
        assert!(snapshot_path.is_file());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn restoring_refuses_a_path_that_is_not_a_snapshot() {
        let dir = scratch_dir("refuse");
        let db_path = dir.join("data.db");
        let mut conn = open_connection(&db_path).unwrap();
        let outcome = restore_migration_snapshot(
            &mut conn,
            &db_path,
            dir.join("other.db").to_string_lossy().into_owned(),
            1,
        );
        assert!(matches!(outcome, Err(DbError::InvalidSnapshotPath)));
        let _ = std::fs::remove_dir_all(&dir);
    }

    const MIGRATED_SCHEMA: &str = "
        CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
        INSERT INTO schema_version (version, applied_at) VALUES (1, 0), (15, 0), (156, 0);
        CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE sessions (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE);
        CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            deleted_at INTEGER
        );
        CREATE INDEX idx_agents_session_id ON agents(session_id);
        CREATE TRIGGER agents_touch_session AFTER INSERT ON agents BEGIN
            UPDATE sessions SET workspace_id = workspace_id WHERE id = new.session_id;
        END;
        CREATE VIEW live_agents AS SELECT * FROM agents WHERE deleted_at IS NULL;
        INSERT INTO workspaces (id, name) VALUES ('w', 'Harborline');
        INSERT INTO sessions (id, workspace_id) VALUES ('s', 'w');
        INSERT INTO agents (id, session_id) VALUES ('a', 's');
    ";

    const TABLE_REBUILD: &str = "
        CREATE TABLE sessions_new (id TEXT PRIMARY KEY);
        ALTER TABLE sessions_new RENAME TO sessions;
    ";

    fn migrated_file_db(name: &str) -> (PathBuf, Connection) {
        let dir = scratch_dir(name);
        let db_path = dir.join("data.db");
        let conn = open_connection(&db_path).unwrap();
        conn.execute_batch(MIGRATED_SCHEMA).unwrap();
        (dir, conn)
    }

    fn schema_objects(conn: &Connection) -> i64 {
        conn.query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get(0))
            .unwrap()
    }

    fn drop_tables_one_by_one(conn: &Connection) {
        let names: Vec<String> = conn
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
        for name in names {
            conn.execute_batch(&format!("DROP TABLE \"{name}\";"))
                .unwrap();
        }
    }

    #[test]
    fn dropping_tables_one_by_one_strands_the_view_that_blocks_a_table_rebuild() {
        let (dir, conn) = migrated_file_db("strand");
        drop_tables_one_by_one(&conn);
        let error = conn.execute_batch(TABLE_REBUILD).unwrap_err().to_string();
        assert!(error.contains("error in view live_agents: no such table: main.agents"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_reset_leaves_an_empty_schema_the_chain_can_replay_on() {
        let (dir, conn) = migrated_file_db("reset");
        let reader = Connection::open(dir.join("data.db")).unwrap();
        assert_ne!(schema_objects(&reader), 0);

        reset_database(&conn).unwrap();

        assert_eq!(schema_objects(&conn), 0);
        assert_eq!(schema_objects(&reader), 0);
        let journal: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(journal, "wal");
        let foreign_keys: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        assert_eq!(foreign_keys, 1);
        conn.execute_batch(TABLE_REBUILD).unwrap();
        conn.execute_batch("DROP TABLE sessions;").unwrap();
        conn.execute_batch(MIGRATED_SCHEMA).unwrap();
        let live: i64 = conn
            .query_row("SELECT count(*) FROM live_agents", [], |row| row.get(0))
            .unwrap();
        assert_eq!(live, 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    const PARTIAL_REPLAY: &str = "
        CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
        CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE sessions (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE);
    ";

    fn half_wiped_file_db(name: &str) -> PathBuf {
        let (dir, conn) = migrated_file_db(name);
        drop_tables_one_by_one(&conn);
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute_batch(PARTIAL_REPLAY).unwrap();
        for version in 1..=14 {
            conn.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?, 0)",
                [version],
            )
            .unwrap();
        }
        assert!(conn.execute_batch(TABLE_REBUILD).is_err());
        drop(conn);
        dir
    }

    #[test]
    fn opening_a_half_wiped_database_finishes_the_wipe() {
        let dir = half_wiped_file_db("half-wiped");

        let conn = open_and_finish_wipe(&dir.join("data.db")).unwrap();

        assert_eq!(schema_objects(&conn), 0);
        conn.execute_batch(TABLE_REBUILD).unwrap();
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_reset_on_open_keeps_a_complete_copy_first() {
        let dir = half_wiped_file_db("backup");
        let db_path = dir.join("data.db");
        let conn = open_connection(&db_path).unwrap();

        let backup = finish_interrupted_wipe(&conn, &db_path, 7)
            .unwrap()
            .unwrap();

        assert_eq!(backup, dir.join("data.db.pre-reset-7.bak"));
        assert!(backup.is_file());
        let copy = Connection::open(&backup).unwrap();
        let applied: i64 = copy
            .query_row("SELECT count(*) FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(applied, 14);
        assert_eq!(schema_objects(&conn), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_broken_view_on_a_complete_schema_is_not_reset() {
        let (dir, conn) = migrated_file_db("broken-view");
        conn.execute_batch(
            "CREATE VIEW live_workspaces AS SELECT * FROM workspaces;
             PRAGMA foreign_keys = OFF;
             DROP TABLE workspaces;",
        )
        .unwrap();
        let before = schema_objects(&conn);
        drop(conn);

        let conn = open_and_finish_wipe(&dir.join("data.db")).unwrap();

        assert_eq!(schema_objects(&conn), before);
        let live: i64 = conn
            .query_row("SELECT count(*) FROM live_agents", [], |row| row.get(0))
            .unwrap();
        assert_eq!(live, 1);
        let backups = std::fs::read_dir(&dir)
            .unwrap()
            .filter(|entry| {
                entry
                    .as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .contains(".pre-reset-")
            })
            .count();
        assert_eq!(backups, 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn opening_a_healthy_database_keeps_its_data() {
        let (dir, conn) = migrated_file_db("healthy");
        let before = schema_objects(&conn);
        drop(conn);

        let conn = open_and_finish_wipe(&dir.join("data.db")).unwrap();

        assert_eq!(schema_objects(&conn), before);
        let live: i64 = conn
            .query_row("SELECT count(*) FROM live_agents", [], |row| row.get(0))
            .unwrap();
        assert_eq!(live, 1);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
