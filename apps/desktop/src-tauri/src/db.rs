use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use rusqlite::config::DbConfig;
use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection, Statement, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number};
use tauri::State;
use thiserror::Error;

use crate::app_paths::{self, APP_DIR};

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
    #[error("a spend cap must be a number above zero")]
    InvalidSpendCap,
}

crate::util::impl_error_serialize!(DbError);

impl DbError {
    pub(crate) fn kind(&self) -> &'static str {
        match self {
            DbError::Sqlite(_) => "sqlite",
            DbError::NoHomeDir => "no_home_dir",
            DbError::AppDir(_) => "app_dir",
            DbError::Poisoned => "poisoned",
            DbError::InvalidSnapshotPath => "invalid_snapshot_path",
            DbError::MigrationSnapshotFilesystem(_) => "migration_snapshot_filesystem",
            DbError::GuardWithoutAbortCode(_) => "guard_without_abort_code",
            DbError::InvalidSpendCap => "invalid_spend_cap",
        }
    }
}

pub struct Db(pub Mutex<Connection>, pub PathBuf, pub AtomicU64);

impl Db {
    pub fn generation(&self) -> u64 {
        self.2.load(Ordering::SeqCst)
    }

    fn bump_generation(&self) -> u64 {
        self.2.fetch_add(1, Ordering::SeqCst) + 1
    }
}

pub fn open() -> Result<Db, DbError> {
    let path = resolve_db_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = open_and_finish_wipe(&path)?;
    Ok(Db(Mutex::new(conn), path, AtomicU64::new(0)))
}

const CORE_TABLES: [&str; 3] = ["schema_version", "sessions", "agents"];

fn open_and_finish_wipe(path: &std::path::Path) -> Result<Connection, DbError> {
    let conn = open_connection(path)?;
    let stamp = crate::util::now_secs();
    match finish_interrupted_wipe(&conn, path, stamp) {
        Ok(Some(backup)) => crate::logging::early(format!(
            "[goodboy] finished an interrupted wipe of the local database, copy kept at {}",
            backup.display()
        )),
        Ok(None) => {}
        Err(error) => crate::logging::early(format!(
            "[goodboy] left a possibly half-wiped database untouched: {}",
            crate::logging::detail(&error)
        )),
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
    restrict_data_files(path)?;
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

const STATEMENT_CACHE_CAPACITY: usize = 128;

const BUSY_TIMEOUT_MS: u32 = 5000;

pub(crate) fn open_connection(path: &std::path::Path) -> Result<Connection, DbError> {
    let conn = Connection::open(path)?;
    conn.set_prepared_statement_cache_capacity(STATEMENT_CACHE_CAPACITY);
    conn.execute_batch(&format!(
        "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = {BUSY_TIMEOUT_MS};"
    ))?;
    restrict_data_files(path)?;
    Ok(conn)
}

pub(crate) fn with_suffix(path: &std::path::Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(suffix);
    PathBuf::from(name)
}

#[cfg(unix)]
fn chmod_if_present(path: &std::path::Path, mode: u32) -> Result<(), DbError> {
    use std::os::unix::fs::PermissionsExt;
    match std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(DbError::MigrationSnapshotFilesystem(error.to_string())),
    }
}

#[cfg(not(unix))]
fn chmod_if_present(_path: &std::path::Path, _mode: u32) -> Result<(), DbError> {
    Ok(())
}

pub(crate) fn restrict_data_files(db_path: &std::path::Path) -> Result<(), DbError> {
    if let Some(parent) = db_path.parent() {
        if parent.file_name().is_some_and(|name| name == APP_DIR) {
            chmod_if_present(parent, 0o700)?;
        }
    }
    let mut files = vec![db_path.to_path_buf()];
    files.extend(snapshot_files(db_path)?);
    for file in files {
        chmod_if_present(&file, 0o600)?;
        for suffix in ["-wal", "-shm"] {
            chmod_if_present(&with_suffix(&file, suffix), 0o600)?;
        }
    }
    Ok(())
}

fn snapshot_files(db_path: &std::path::Path) -> Result<Vec<PathBuf>, DbError> {
    let Some(parent) = db_path.parent() else {
        return Ok(Vec::new());
    };
    let prefix = format!(
        "{}.",
        db_path.file_name().unwrap_or_default().to_string_lossy()
    );
    let entries = match std::fs::read_dir(parent) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(DbError::MigrationSnapshotFilesystem(error.to_string())),
    };
    let mut files = Vec::new();
    for entry in entries {
        let path = entry
            .map_err(|error| DbError::MigrationSnapshotFilesystem(error.to_string()))?
            .path();
        let file = path.file_name().unwrap_or_default().to_string_lossy();
        let is_snapshot = file.starts_with(&prefix) && file.ends_with(".bak");
        if is_snapshot {
            files.push(path);
        }
    }
    Ok(files)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationSnapshotRequest {
    pub current_version: u32,
    pub next_version: u32,
    pub stamp: String,
}

fn is_snapshot_stamp(stamp: &str) -> bool {
    let bytes = stamp.as_bytes();
    bytes.len() == 19
        && bytes[8] == b'T'
        && bytes[18] == b'Z'
        && bytes[..8].iter().all(u8::is_ascii_digit)
        && bytes[9..18].iter().all(u8::is_ascii_digit)
}

pub(crate) fn create_migration_snapshot(
    conn: &Connection,
    db_path: &std::path::Path,
    request: &MigrationSnapshotRequest,
) -> Result<PathBuf, DbError> {
    if !is_snapshot_stamp(&request.stamp) {
        return Err(DbError::InvalidSnapshotPath);
    }
    let snapshot = with_suffix(
        db_path,
        &format!(
            ".pre-m{}-from-m{}-{}.bak",
            request.next_version, request.current_version, request.stamp
        ),
    );
    conn.execute("VACUUM INTO ?1", [snapshot.to_string_lossy().as_ref()])?;
    restrict_data_files(db_path)?;
    Ok(snapshot)
}

#[tauri::command(async)]
pub fn db_create_migration_snapshot(
    state: State<'_, Db>,
    request: MigrationSnapshotRequest,
) -> Result<String, DbError> {
    let conn = lock_connection(&state, "db_create_migration_snapshot")?;
    let snapshot = create_migration_snapshot(&conn, &state.1, &request)?;
    Ok(snapshot.to_string_lossy().into_owned())
}

#[tauri::command(async)]
pub fn db_vacuum(state: State<'_, Db>) -> Result<(), DbError> {
    let conn = lock_connection(&state, "db_vacuum")?;
    crate::logging::timed("db_vacuum", || {
        conn.execute_batch("VACUUM;")?;
        Ok(())
    })
}

#[tauri::command]
pub async fn db_secure_files(state: State<'_, Db>) -> Result<(), DbError> {
    let db_path = state.1.clone();
    tauri::async_runtime::spawn_blocking(move || restrict_data_files(&db_path))
        .await
        .map_err(|e| DbError::MigrationSnapshotFilesystem(e.to_string()))?
}

pub(crate) fn move_if_present(from: &std::path::Path, to: &std::path::Path) -> Result<(), DbError> {
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
    previous
        .close()
        .map_err(|(_, error)| DbError::Sqlite(error))?;
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
    let stamp = u128::from(crate::util::now_millis_u64());
    restore_migration_snapshot(&mut conn, &state.1, path, stamp)
}

/// Resolves the SQLite file. Precedence:
///   1. `GOODBOY_DB_FILE` env (absolute path verbatim, relative under `~/.goodboy`).
///   2. Debug builds (`pnpm tauri dev`) -> `data.dev.db`, a private playground.
///   3. Release builds (the shipped app) -> `data.db`, the production file.
///      Splitting on `debug_assertions` keeps local experiments off the prod DB
///      automatically, with no env setup required.
pub fn resolve_db_path() -> Result<PathBuf, DbError> {
    let dir = app_paths::data_dir().map_err(|_| DbError::NoHomeDir)?;

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

const ALLOWED_PRAGMAS: [&str; 12] = [
    "data_version",
    "foreign_keys",
    "foreign_key_check",
    "foreign_key_list",
    "index_list",
    "index_info",
    "integrity_check",
    "page_count",
    "page_size",
    "table_info",
    "table_xinfo",
    "user_version",
];

fn authorize_webview_sql(context: AuthContext<'_>) -> Authorization {
    match context.action {
        AuthAction::Attach { .. } | AuthAction::Detach { .. } => Authorization::Deny,
        AuthAction::Pragma { pragma_name, .. } => {
            if ALLOWED_PRAGMAS
                .iter()
                .any(|allowed| allowed.eq_ignore_ascii_case(pragma_name))
            {
                return Authorization::Allow;
            }
            Authorization::Deny
        }
        _ => Authorization::Allow,
    }
}

fn run_webview_sql<T>(
    conn: &mut Connection,
    run: impl FnOnce(&mut Connection) -> Result<T, DbError>,
) -> Result<T, DbError> {
    conn.authorizer(Some(authorize_webview_sql))?;
    let outcome = run(conn);
    conn.authorizer(None::<fn(AuthContext<'_>) -> Authorization>)?;
    outcome
}

fn lock_connection<'a>(
    state: &'a State<'_, Db>,
    command: &str,
) -> Result<std::sync::MutexGuard<'a, Connection>, DbError> {
    let started = std::time::Instant::now();
    let guard = state.0.lock().map_err(|_| DbError::Poisoned);
    crate::logging::slow(&format!("{command} lock wait"), started);
    guard
}

#[tauri::command(async)]
pub fn db_exec(state: State<'_, Db>, sql: String) -> Result<(), DbError> {
    let mut conn = lock_connection(&state, "db_exec")?;
    crate::logging::timed("db_exec", || {
        run_webview_sql(&mut conn, |conn| {
            conn.execute_batch(&sql)?;
            Ok(())
        })
    })
}

#[tauri::command(async)]
pub fn db_execute(
    state: State<'_, Db>,
    sql: String,
    params: Option<Vec<SqlParam>>,
) -> Result<ExecResult, DbError> {
    let mut conn = lock_connection(&state, "db_execute")?;
    crate::logging::timed("db_execute", || {
        run_webview_sql(&mut conn, |conn| {
            execute_sql(conn, &sql, &params.unwrap_or_default())
        })
    })
}

fn execute_sql(conn: &Connection, sql: &str, params: &[SqlParam]) -> Result<ExecResult, DbError> {
    let mut stmt = conn.prepare_cached(sql)?;
    let values: Vec<Value> = params.iter().map(SqlParam::to_value).collect();
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
    state.bump_generation();
    crate::stop_running_work(&app);
    crate::query_bridge::shutdown();
    crate::repo_clone::reopen(&tauri::Manager::state::<crate::repo_clone::CloneRegistry>(
        &app,
    ));
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    reset_database(&conn)
}

#[tauri::command(async)]
pub fn db_select(
    state: State<'_, Db>,
    sql: String,
    params: Option<Vec<SqlParam>>,
) -> Result<Vec<Map<String, serde_json::Value>>, DbError> {
    let mut conn = lock_connection(&state, "db_select")?;
    crate::logging::timed("db_select", || {
        run_webview_sql(&mut conn, |conn| {
            select_rows(conn, &sql, &params.unwrap_or_default())
        })
    })
}

fn select_rows(
    conn: &Connection,
    sql: &str,
    params: &[SqlParam],
) -> Result<Vec<Map<String, serde_json::Value>>, DbError> {
    let mut stmt = conn.prepare_cached(sql)?;
    Ok(collect_rows(&mut stmt, params)?)
}

fn collect_rows(
    stmt: &mut Statement<'_>,
    params: &[SqlParam],
) -> Result<Vec<Map<String, serde_json::Value>>, rusqlite::Error> {
    let values: Vec<Value> = params.iter().map(SqlParam::to_value).collect();
    let mut rows = stmt.query(params_from_iter(values.iter()))?;
    let mut column_names: Option<Vec<String>> = None;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        let names = column_names.get_or_insert_with(|| {
            row.as_ref()
                .column_names()
                .into_iter()
                .map(String::from)
                .collect()
        });
        let mut record = Map::new();
        for (idx, name) in names.iter().enumerate() {
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
    let mut stmt = conn.prepare_cached(&statement.sql)?;
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
    let mut conn = lock_connection(&state, "db_transaction")?;
    crate::logging::timed("db_transaction", || {
        run_webview_sql(&mut conn, |conn| run_transaction(conn, &statements))
    })
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

    fn run_batch(conn: &mut Connection, sql: &str) -> Result<(), DbError> {
        run_webview_sql(conn, |conn| {
            conn.execute_batch(sql)?;
            Ok(())
        })
    }

    #[test]
    fn webview_sql_refuses_attach_and_leaves_no_file() {
        let dir = std::env::temp_dir().join(format!("gb-auth-attach-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("stolen.db");
        let mut conn = memory_db();
        let sql = format!(
            "ATTACH DATABASE '{}' AS stolen; CREATE TABLE stolen.t (x INTEGER);",
            target.display()
        );
        assert!(run_batch(&mut conn, &sql).is_err());
        assert!(!target.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn webview_sql_refuses_vacuum_into_and_leaves_no_file() {
        let dir = std::env::temp_dir().join(format!("gb-auth-vacuum-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("copy.db");
        let mut conn = memory_db();
        let sql = format!("VACUUM INTO '{}'", target.display());
        assert!(run_batch(&mut conn, &sql).is_err());
        assert!(!target.exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn webview_sql_refuses_a_plain_vacuum_so_the_prune_uses_the_native_command() {
        let (_, path) = app_home("webview-plain-vacuum");
        let mut conn = open_connection(&path).unwrap();
        conn.execute_batch("CREATE TABLE workspaces (id TEXT);")
            .unwrap();
        assert!(run_batch(&mut conn, "VACUUM").is_err());
        conn.execute_batch("VACUUM;").unwrap();
    }

    #[test]
    fn webview_sql_refuses_a_pragma_outside_the_allow_list() {
        let mut conn = memory_db();
        assert!(run_batch(&mut conn, "PRAGMA journal_mode = DELETE").is_err());
        assert!(run_batch(&mut conn, "PRAGMA writable_schema = ON").is_err());
    }

    #[test]
    fn webview_sql_keeps_the_pragmas_migrations_use() {
        let mut conn = memory_db();
        run_batch(
            &mut conn,
            "PRAGMA foreign_keys = OFF; INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('w1', 'Acme', 'acme', 1, 1); PRAGMA foreign_key_check; PRAGMA foreign_keys = ON;",
        )
        .unwrap();
        let count: i64 = conn
            .query_row("SELECT count(*) FROM workspaces", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn webview_sql_drops_the_authorizer_after_each_call() {
        let mut conn = memory_db();
        assert!(run_batch(&mut conn, "PRAGMA journal_mode = DELETE").is_err());
        conn.execute_batch("PRAGMA synchronous = NORMAL").unwrap();
    }

    const WORKSPACE_INSERT_SQL: &str =
        "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?1, ?2, ?1, 1, 1)";

    fn memory_db() -> Connection {
        crate::test_support::migrated_connection()
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
            WORKSPACE_INSERT_SQL,
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
    fn the_bundled_sqlite_runs_the_search_index_and_its_triggers() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL);
             CREATE VIRTUAL TABLE search_index USING fts5(
               title, body, tokenize = 'unicode61 remove_diacritics 2'
             );
             CREATE TRIGGER search_workspace_insert AFTER INSERT ON workspaces BEGIN
               DELETE FROM search_index WHERE title = NEW.id;
               INSERT INTO search_index (title, body) VALUES (NEW.id, NEW.name);
             END;",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO workspaces (id, name) VALUES ('harborline', 'Payout export café')",
            [],
        )
        .unwrap();
        let hit: String = conn
            .query_row(
                "SELECT snippet(search_index, 1, '[', ']', '', 8) FROM search_index
                 WHERE search_index MATCH 'cafe OR pay*' ORDER BY bm25(search_index, 4.0, 1.0)",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(hit, "[Payout] export [café]");
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
        let dir =
            std::env::temp_dir().join(format!("goodboy-db-restore-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn a_connection_enforces_keys_waits_for_a_lock_and_runs_wal() {
        let dir = scratch_dir("pragmas");
        let conn = open_connection(&dir.join("data.db")).unwrap();
        let read = |pragma: &str| -> i64 {
            conn.query_row(&format!("PRAGMA {pragma}"), [], |row| row.get(0))
                .unwrap()
        };

        assert_eq!(read("foreign_keys"), 1);
        assert_eq!(read("busy_timeout"), i64::from(BUSY_TIMEOUT_MS));
        assert_eq!(read("synchronous"), 1);
        let mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(mode, "wal");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_long_select_does_not_block_a_transaction_on_another_connection() {
        let dir = scratch_dir("long-select");
        let path = dir.join("data.db");
        let writer = open_connection(&path).unwrap();
        crate::test_support::apply_migrated_schema(&writer);
        writer
            .execute_batch(
                "INSERT INTO settings (key, value, updated_at)
                 VALUES ('1', 'Harborline', 1), ('2', 'Northwind', 1), ('3', 'Acme', 1);",
            )
            .unwrap();
        let reader = open_connection(&path).unwrap();
        let mut select = reader
            .prepare("SELECT value FROM settings ORDER BY key")
            .unwrap();
        let mut rows = select.query([]).unwrap();
        let first: String = rows.next().unwrap().unwrap().get(0).unwrap();

        writer
            .execute_batch(
                "BEGIN IMMEDIATE;
                 INSERT INTO settings (key, value, updated_at) VALUES ('4', 'Cascadia', 1);
                 COMMIT;",
            )
            .unwrap();

        assert_eq!(first, "Harborline");
        let mut seen: Vec<String> = Vec::new();
        while let Some(row) = rows.next().unwrap() {
            seen.push(row.get(0).unwrap());
        }
        assert_eq!(seen, vec!["Northwind", "Acme"]);
        let total: i64 = writer
            .query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 4);
        drop(rows);
        drop(select);
        let _ = std::fs::remove_dir_all(dir);
    }

    fn marker(conn: &Connection) -> String {
        conn.query_row("SELECT name FROM workspaces", [], |row| row.get(0))
            .unwrap()
    }

    fn seed_marker(conn: &Connection, name: &str) {
        crate::test_support::apply_migrated_schema(conn);
        conn.execute(WORKSPACE_INSERT_SQL, ["a", name]).unwrap();
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
    fn a_wipe_bumps_the_generation_so_a_snapshot_taken_before_it_goes_stale() {
        let (dir, conn) = migrated_file_db("generation");
        let db = Db(Mutex::new(conn), dir.clone(), AtomicU64::new(0));

        let before_wipe = db.generation();
        let bumped = db.bump_generation();

        assert_eq!(before_wipe, 0);
        assert_eq!(bumped, 1);
        assert_eq!(db.generation(), 1);
        assert_ne!(db.generation(), before_wipe);
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

    fn times_run(conn: &Connection, sql: &str) -> i32 {
        conn.prepare_cached(sql)
            .unwrap()
            .get_status(rusqlite::StatementStatus::Run)
    }

    const WORKSPACE_COUNT_SQL: &str = "SELECT COUNT(*) AS n FROM workspaces";

    #[test]
    fn db_select_reuses_one_compiled_statement_per_sql_text() {
        let conn = memory_db();
        select_rows(&conn, WORKSPACE_COUNT_SQL, &[]).unwrap();
        select_rows(&conn, WORKSPACE_COUNT_SQL, &[]).unwrap();
        select_rows(&conn, WORKSPACE_COUNT_SQL, &[]).unwrap();

        assert_eq!(times_run(&conn, WORKSPACE_COUNT_SQL), 3);
    }

    #[test]
    fn db_execute_reuses_one_compiled_statement_per_sql_text() {
        let conn = memory_db();
        let sql = WORKSPACE_INSERT_SQL;
        for id in ["a", "b", "c"] {
            let params = [
                SqlParam::Text(id.to_string()),
                SqlParam::Text("x".to_string()),
            ];
            assert_eq!(execute_sql(&conn, sql, &params).unwrap().rows_affected, 1);
        }

        assert_eq!(times_run(&conn, sql), 3);
        assert_eq!(count(&conn), 3);
    }

    #[test]
    fn a_transaction_reuses_one_compiled_statement_per_sql_text() {
        let mut conn = memory_db();
        let batch: Vec<TxStatement> = ["a", "b", "c"].into_iter().map(insert).collect();
        run_transaction(&mut conn, &batch).unwrap();
        run_transaction(&mut conn, &[insert("d")]).unwrap();

        assert_eq!(times_run(&conn, WORKSPACE_INSERT_SQL), 4);
        assert_eq!(count(&conn), 4);
    }

    #[test]
    fn a_reused_statement_binds_fresh_params_and_returns_fresh_rows() {
        let conn = memory_db();
        let sql = "SELECT name FROM workspaces WHERE id = ?";
        for (id, name) in [("a", "one"), ("b", "two")] {
            execute_sql(
                &conn,
                WORKSPACE_INSERT_SQL,
                &[
                    SqlParam::Text(id.to_string()),
                    SqlParam::Text(name.to_string()),
                ],
            )
            .unwrap();
        }
        let read = |id: &str| select_rows(&conn, sql, &[SqlParam::Text(id.to_string())]).unwrap();

        assert_eq!(read("a")[0]["name"], serde_json::json!("one"));
        assert_eq!(read("b")[0]["name"], serde_json::json!("two"));
        assert!(read("missing").is_empty());
        assert_eq!(times_run(&conn, sql), 3);
    }

    #[test]
    fn a_cached_select_star_sees_a_column_added_after_it_was_compiled() {
        let conn = memory_db();
        let sql = "SELECT * FROM settings";
        select_rows(&conn, sql, &[]).unwrap();
        conn.execute_batch(
            "ALTER TABLE settings ADD COLUMN color TEXT DEFAULT 'blue';
             INSERT INTO settings (key, value, updated_at) VALUES ('a', 'one', 1);",
        )
        .unwrap();

        let rows = select_rows(&conn, sql, &[]).unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["color"], serde_json::json!("blue"));
        assert_eq!(rows[0].len(), 4);
    }

    #[test]
    fn the_opened_connection_keeps_more_statements_than_the_default_cache() {
        let dir = scratch_dir("statement-cache");
        let conn = open_connection(&dir.join("data.db")).unwrap();
        crate::test_support::apply_migrated_schema(&conn);
        let sqls: Vec<String> = (0..100)
            .map(|index| format!("SELECT {index} AS n FROM workspaces"))
            .collect();
        for sql in &sqls {
            select_rows(&conn, sql, &[]).unwrap();
        }
        for sql in &sqls {
            select_rows(&conn, sql, &[]).unwrap();
        }

        assert!(sqls.iter().all(|sql| times_run(&conn, sql) == 2));
        assert!(STATEMENT_CACHE_CAPACITY >= sqls.len());
    }

    #[cfg(unix)]
    fn mode_of(path: &std::path::Path) -> u32 {
        use std::os::unix::fs::PermissionsExt;
        std::fs::metadata(path).unwrap().permissions().mode() & 0o777
    }

    fn app_home(name: &str) -> (PathBuf, PathBuf) {
        let app = scratch_dir(name).join(APP_DIR);
        std::fs::create_dir_all(&app).unwrap();
        let path = app.join("data.db");
        (app, path)
    }

    #[cfg(unix)]
    #[test]
    fn opening_locks_the_home_and_the_database_files_to_the_owner() {
        use std::os::unix::fs::PermissionsExt;
        let (app, path) = app_home("perm-open");
        std::fs::set_permissions(&app, std::fs::Permissions::from_mode(0o755)).unwrap();
        let conn = open_and_finish_wipe(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (id TEXT); INSERT INTO workspaces VALUES ('a');",
        )
        .unwrap();
        restrict_data_files(&path).unwrap();
        assert_eq!(mode_of(&app), 0o700);
        for suffix in ["", "-wal", "-shm"] {
            let file = with_suffix(&path, suffix);
            assert!(file.exists(), "{suffix} missing");
            assert_eq!(mode_of(&file), 0o600, "{suffix}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn every_snapshot_is_owner_only_after_it_is_written() {
        use std::os::unix::fs::PermissionsExt;
        let (_, path) = app_home("perm-snapshot");
        let conn = open_connection(&path).unwrap();
        conn.execute_batch("CREATE TABLE workspaces (id TEXT);")
            .unwrap();
        let snapshot = with_suffix(&path, ".pre-m2-from-m1-20260822T120000000Z.bak");
        conn.execute_batch(&format!("VACUUM INTO '{}'", snapshot.display()))
            .unwrap();
        std::fs::set_permissions(&snapshot, std::fs::Permissions::from_mode(0o644)).unwrap();
        restrict_data_files(&path).unwrap();
        assert_eq!(mode_of(&snapshot), 0o600);
    }

    fn snapshot_request() -> MigrationSnapshotRequest {
        MigrationSnapshotRequest {
            current_version: 233,
            next_version: 234,
            stamp: "20260822T120000000Z".to_string(),
        }
    }

    #[test]
    fn the_snapshot_command_path_works_where_webview_vacuum_is_refused() {
        let (_, path) = app_home("snapshot-under-authorizer");
        let mut conn = open_connection(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
             INSERT INTO schema_version VALUES (233, 1);
             CREATE TABLE workspaces (id TEXT);
             INSERT INTO workspaces VALUES ('northwind');",
        )
        .unwrap();
        let direct = with_suffix(&path, ".pre-m234-from-m233-20260822T120000000Z.bak");

        let refused = run_webview_sql(&mut conn, |conn| {
            conn.execute_batch(&format!("VACUUM INTO '{}'", direct.display()))?;
            Ok(())
        });
        assert!(refused.is_err());
        assert!(!direct.exists());

        let snapshot = run_webview_sql(&mut conn, |_| Ok(()))
            .and_then(|_| create_migration_snapshot(&conn, &path, &snapshot_request()))
            .unwrap();

        assert_eq!(snapshot, direct);
        let copy = Connection::open(&snapshot).unwrap();
        let version: i64 = copy
            .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
                row.get(0)
            })
            .unwrap();
        let row: String = copy
            .query_row("SELECT id FROM workspaces", [], |row| row.get(0))
            .unwrap();
        assert_eq!((version, row.as_str()), (233, "northwind"));
        assert!(db_list_migration_snapshots_blocking(path.clone())
            .unwrap()
            .contains(&snapshot.to_string_lossy().into_owned()));
    }

    #[test]
    fn the_snapshot_command_refuses_a_stamp_that_could_escape_the_data_folder() {
        let (_, path) = app_home("snapshot-bad-stamp");
        let conn = open_connection(&path).unwrap();
        for stamp in ["../../x", "2026-08-22T12:00:00Z", "20260822T120000000Z.db"] {
            let request = MigrationSnapshotRequest {
                stamp: stamp.to_string(),
                ..snapshot_request()
            };
            assert!(matches!(
                create_migration_snapshot(&conn, &path, &request),
                Err(DbError::InvalidSnapshotPath)
            ));
        }
    }

    #[cfg(unix)]
    #[test]
    fn the_snapshot_command_leaves_the_snapshot_owner_only() {
        let (_, path) = app_home("snapshot-owner-only");
        let conn = open_connection(&path).unwrap();
        conn.execute_batch("CREATE TABLE workspaces (id TEXT);")
            .unwrap();
        let snapshot = create_migration_snapshot(&conn, &path, &snapshot_request()).unwrap();
        assert_eq!(mode_of(&snapshot), 0o600);
    }

    #[cfg(unix)]
    #[test]
    fn a_reset_copy_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let (_, path) = app_home("perm-reset");
        let conn = open_connection(&path).unwrap();
        conn.execute_batch("CREATE TABLE workspaces (id TEXT);")
            .unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        let backup = back_up_before_reset(&conn, &path, 7).unwrap();
        assert_eq!(mode_of(&backup), 0o600);
    }

    #[cfg(unix)]
    #[test]
    fn a_custom_database_folder_is_not_touched() {
        use std::os::unix::fs::PermissionsExt;
        let dir = scratch_dir("perm-custom");
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).unwrap();
        let path = dir.join("data.db");
        open_connection(&path).unwrap();
        assert_eq!(mode_of(&dir), 0o755);
        assert_eq!(mode_of(&path), 0o600);
    }

    const HYGIENE_PR_CACHE_DELETE: &str = "DELETE FROM github_pr_cache
         WHERE NOT EXISTS (
           SELECT 1
           FROM session_worktrees sw
           JOIN sessions s ON s.id = sw.session_id
           WHERE sw.branch = github_pr_cache.branch
             AND sw.repo_slug IS github_pr_cache.repo_slug
             AND s.deleted_at IS NULL
             AND s.archived_at IS NULL
         )";

    const PR_CACHE_INSERT: &str =
        "INSERT INTO github_pr_cache (branch, repo_slug, pr_json, fetched_at)
         VALUES ('feat/payout-export', 'harborline/ledger-core', '{\"number\": 7, \"state\": \"open\", \"title\": \"Payout export\"}', 1)";

    fn search_doc_count(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM search_docs", [], |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn webview_sql_allows_the_data_version_read_only_pragma() {
        let mut conn = memory_db();
        run_batch(&mut conn, "PRAGMA data_version").unwrap();
        assert!(run_batch(&mut conn, "PRAGMA journal_mode = DELETE").is_err());
    }

    #[test]
    fn webview_sql_writes_through_the_search_index_triggers() {
        let mut conn = memory_db();
        run_batch(&mut conn, PR_CACHE_INSERT).unwrap();
        assert_eq!(search_doc_count(&conn), 1);
        run_batch(&mut conn, HYGIENE_PR_CACHE_DELETE).unwrap();
        assert_eq!(search_doc_count(&conn), 0);
    }

    #[test]
    fn webview_sql_runs_the_boot_hygiene_on_a_database_already_at_the_latest_schema() {
        let dir = scratch_dir("boot-retry");
        let mut conn = open_connection(&dir.join("data.db")).unwrap();
        crate::test_support::apply_migrated_schema(&conn);
        for _ in 0..2 {
            run_batch(&mut conn, PR_CACHE_INSERT).unwrap();
            run_batch(&mut conn, HYGIENE_PR_CACHE_DELETE).unwrap();
            let rows = run_webview_sql(&mut conn, |conn| {
                select_rows(conn, "SELECT COUNT(*) AS n FROM sqlite_master", &[])
            })
            .unwrap();
            assert_eq!(rows.len(), 1);
        }
        assert_eq!(search_doc_count(&conn), 0);
    }
}
