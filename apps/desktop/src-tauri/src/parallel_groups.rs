use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::db::{Db, DbError};
use crate::turn::{spawn_one, SpawnOneArgs, TurnError, TurnRegistry};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct ParallelGroupRow {
    pub id: String,
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub ordinal: i64,
    #[serde(rename = "mergeStrategy")]
    pub merge_strategy: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ParallelPhaseGroupCreateInput {
    pub id: Option<String>,
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub ordinal: i64,
    #[serde(rename = "mergeStrategy")]
    pub merge_strategy: String,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum ParallelPhaseError {
    #[error("db error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("db mutex poisoned")]
    Poisoned,
    #[error("parallel phase group not found: {0}")]
    GroupNotFound(String),
}

impl Serialize for ParallelPhaseError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serde_json::Map::new();
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

impl ParallelPhaseError {
    fn kind(&self) -> &'static str {
        match self {
            ParallelPhaseError::Db(_) => "db",
            ParallelPhaseError::Poisoned => "poisoned",
            ParallelPhaseError::GroupNotFound(_) => "group_not_found",
        }
    }
}

impl From<DbError> for ParallelPhaseError {
    fn from(e: DbError) -> Self {
        match e {
            DbError::Sqlite(inner) => ParallelPhaseError::Db(inner),
            DbError::Poisoned => ParallelPhaseError::Poisoned,
            _ => ParallelPhaseError::Db(rusqlite::Error::InvalidQuery),
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Parse ISO 8601 string → unix epoch ms.
fn iso_to_epoch_ms(iso: &str) -> i64 {
    let bytes = iso.as_bytes();
    if bytes.len() < 19 {
        return 0;
    }
    let year: i64 = parse_digits(bytes, 0, 4);
    let month: u32 = parse_digits(bytes, 5, 2) as u32;
    let day: u32 = parse_digits(bytes, 8, 2) as u32;
    let hour: u32 = parse_digits(bytes, 11, 2) as u32;
    let min: u32 = parse_digits(bytes, 14, 2) as u32;
    let sec: u32 = parse_digits(bytes, 17, 2) as u32;

    let ms: i64 = if bytes.len() > 19 && bytes[19] == b'.' {
        parse_digits(bytes, 20, 3)
    } else {
        0
    };

    let epoch_secs = datetime_to_epoch_secs(year, month, day, hour, min, sec);
    epoch_secs * 1000 + ms
}

fn parse_digits(bytes: &[u8], start: usize, len: usize) -> i64 {
    let mut v: i64 = 0;
    for i in start..start + len {
        if i >= bytes.len() {
            break;
        }
        let b = bytes[i];
        if b.is_ascii_digit() {
            v = v * 10 + (b - b'0') as i64;
        }
    }
    v
}

fn datetime_to_epoch_secs(year: i64, month: u32, day: u32, hour: u32, min: u32, sec: u32) -> i64 {
    let mut days: i64 = 0;
    for y in 1970..year {
        days += if is_leap_year(y) { 366 } else { 365 };
    }
    for m in 1..month {
        days += days_in_month(year, m);
    }
    days += (day as i64) - 1;
    days * 86400 + (hour as i64) * 3600 + (min as i64) * 60 + (sec as i64)
}

/// Convert unix epoch ms → ISO 8601 string (UTC).
fn epoch_ms_to_iso(ms: i64) -> String {
    let secs = ms / 1000;
    let (year, month, day, hour, min, sec) = epoch_secs_to_datetime(secs);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

fn now_epoch_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn uuid_v4() -> String {
    use sha2::{Digest, Sha256};
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let pid = std::process::id();
    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let seq = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let input = format!("{}-{}-{}", t.as_nanos(), pid, seq);
    let hash = Sha256::digest(input.as_bytes());
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-4{:01x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        hash[0], hash[1], hash[2], hash[3],
        hash[4], hash[5],
        hash[6] & 0x0f, hash[7],
        (hash[8] & 0x3f) | 0x80, hash[9],
        hash[10], hash[11], hash[12], hash[13], hash[14], hash[15],
    )
}

fn is_leap_year(y: i64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

fn days_in_month(y: i64, m: u32) -> i64 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if is_leap_year(y) {
                29
            } else {
                28
            }
        }
        _ => unreachable!(),
    }
}

fn epoch_secs_to_datetime(mut s: i64) -> (i64, u32, u32, u32, u32, u32) {
    let sec = (s % 60) as u32;
    s /= 60;
    let min = (s % 60) as u32;
    s /= 60;
    let hour = (s % 24) as u32;
    s /= 24;
    let mut year: i64 = 1970;
    loop {
        let days = if is_leap_year(year) { 366 } else { 365 };
        if s < days {
            break;
        }
        s -= days;
        year += 1;
    }
    let mut month: u32 = 1;
    loop {
        let d = days_in_month(year, month);
        if s < d {
            break;
        }
        s -= d;
        month += 1;
    }
    let day = s as u32 + 1;
    (year, month, day, hour, min, sec)
}

fn row_to_group(row: &rusqlite::Row<'_>) -> Result<ParallelGroupRow, rusqlite::Error> {
    let id: String = row.get(0)?;
    let task_id: String = row.get(1)?;
    let ordinal: i64 = row.get(2)?;
    let merge_strategy: String = row.get(3)?;
    let created_at_ms: i64 = row.get(4)?;
    let completed_at_ms: Option<i64> = row.get(5)?;
    Ok(ParallelGroupRow {
        id,
        task_id,
        ordinal,
        merge_strategy,
        created_at: epoch_ms_to_iso(created_at_ms),
        completed_at: completed_at_ms.map(epoch_ms_to_iso),
    })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn parallel_group_create(
    state: State<'_, Db>,
    input: ParallelPhaseGroupCreateInput,
) -> Result<ParallelGroupRow, ParallelPhaseError> {
    let conn = state.0.lock().map_err(|_| ParallelPhaseError::Poisoned)?;
    let id = input.id.unwrap_or_else(uuid_v4);
    let created_at_ms = input
        .created_at
        .as_deref()
        .map(iso_to_epoch_ms)
        .unwrap_or_else(now_epoch_ms);

    conn.execute(
        "INSERT INTO parallel_groups
           (id, task_id, ordinal, merge_strategy, created_at, completed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
        rusqlite::params![
            id,
            input.task_id,
            input.ordinal,
            input.merge_strategy,
            created_at_ms,
        ],
    )?;

    Ok(ParallelGroupRow {
        id,
        task_id: input.task_id,
        ordinal: input.ordinal,
        merge_strategy: input.merge_strategy,
        created_at: epoch_ms_to_iso(created_at_ms),
        completed_at: None,
    })
}

#[tauri::command]
pub fn parallel_group_list(
    state: State<'_, Db>,
    task_id: String,
) -> Result<Vec<ParallelGroupRow>, ParallelPhaseError> {
    let conn = state.0.lock().map_err(|_| ParallelPhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, task_id, ordinal, merge_strategy, created_at, completed_at
         FROM parallel_groups
         WHERE task_id = ?1
         ORDER BY ordinal ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![task_id], row_to_group)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(ParallelPhaseError::Db)
}

#[tauri::command]
pub fn parallel_group_get(
    state: State<'_, Db>,
    id: String,
) -> Result<Option<ParallelGroupRow>, ParallelPhaseError> {
    let conn = state.0.lock().map_err(|_| ParallelPhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, task_id, ordinal, merge_strategy, created_at, completed_at
         FROM parallel_groups
         WHERE id = ?1
         LIMIT 1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![id], row_to_group)?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(ParallelPhaseError::Db)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn parallel_group_delete(
    state: State<'_, Db>,
    id: String,
) -> Result<(), ParallelPhaseError> {
    let conn = state.0.lock().map_err(|_| ParallelPhaseError::Poisoned)?;

    let exists: bool = {
        let mut stmt =
            conn.prepare("SELECT 1 FROM parallel_groups WHERE id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![id], |_| Ok(()))?;
        rows.next().is_some()
    };

    if !exists {
        return Err(ParallelPhaseError::GroupNotFound(id));
    }

    conn.execute(
        "DELETE FROM parallel_groups WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn parallel_group_update_completed_at(
    state: State<'_, Db>,
    id: String,
    completed_at: String,
) -> Result<ParallelGroupRow, ParallelPhaseError> {
    let conn = state.0.lock().map_err(|_| ParallelPhaseError::Poisoned)?;
    let completed_at_ms = iso_to_epoch_ms(&completed_at);

    let updated = conn.execute(
        "UPDATE parallel_groups SET completed_at = ?2 WHERE id = ?1",
        rusqlite::params![id, completed_at_ms],
    )?;

    if updated == 0 {
        return Err(ParallelPhaseError::GroupNotFound(id.clone()));
    }

    let mut stmt = conn.prepare(
        "SELECT id, task_id, ordinal, merge_strategy, created_at, completed_at
         FROM parallel_groups
         WHERE id = ?1
         LIMIT 1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![id.clone()], row_to_group)?;
    match rows.next() {
        Some(r) => Ok(r.map_err(ParallelPhaseError::Db)?),
        None => Err(ParallelPhaseError::GroupNotFound(id)),
    }
}

// ---------------------------------------------------------------------------
// Parallel run spawn
// ---------------------------------------------------------------------------

/// One run within a parallel phase — carries the per-process identity.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParallelRunSpec {
    pub run_id: String,
    /// Worktree path produced by C3 worktree helper.
    pub working_dir: String,
    /// Zero-based index among sibling runs in the group.
    #[allow(dead_code)]
    pub parallel_index: u32,
}

/// Arguments for spawning a batch of parallel runs in one invoke.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParallelSpawnArgs {
    /// Parallel phase group this batch belongs to (for tracing / audit).
    #[allow(dead_code)]
    pub group_id: String,
    pub runs: Vec<ParallelRunSpec>,
    #[serde(default)]
    pub binary: Option<String>,
    pub model: String,
    pub prompt: String,
    #[serde(default)]
    pub permission_mode: Option<String>,
    #[serde(default)]
    pub allowed_tools: Vec<String>,
    #[serde(default)]
    pub disallowed_tools: Vec<String>,
}

/// Spawn N child processes concurrently (one per `ParallelRunSpec`).
///
/// Each child is registered in `TurnRegistry` with its own `run_id` and emits
/// `turn_event` envelopes tagged with that `run_id`. Returns all launched
/// `run_id`s once every child has been spawned (threads run independently).
/// Cancelling a single `run_id` via `turn_cancel` does not affect siblings.
#[tauri::command]
pub fn parallel_session_spawn(
    app: AppHandle,
    state: State<'_, TurnRegistry>,
    args: ParallelSpawnArgs,
) -> Result<Vec<String>, TurnError> {
    let binary = args.binary.as_deref().unwrap_or("claude");
    let permission_mode = args
        .permission_mode
        .as_deref()
        .unwrap_or("default")
        .to_string();

    let mut run_ids: Vec<String> = Vec::with_capacity(args.runs.len());

    for spec in &args.runs {
        let run_id = spawn_one(
            &app,
            &state.0,
            SpawnOneArgs {
                run_id: &spec.run_id,
                binary,
                model: &args.model,
                working_dir: &spec.working_dir,
                prompt: &args.prompt,
                permission_mode: &permission_mode,
                allowed_tools: &args.allowed_tools,
                disallowed_tools: &args.disallowed_tools,
            },
        )?;
        run_ids.push(run_id);
    }

    Ok(run_ids)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parallel_spawn_args_defaults() {
        let json = r#"{
            "groupId": "g1",
            "runs": [
                {"runId": "r1", "workingDir": "/tmp/wt1", "parallelIndex": 0},
                {"runId": "r2", "workingDir": "/tmp/wt2", "parallelIndex": 1}
            ],
            "model": "claude-3-opus",
            "prompt": "do the thing"
        }"#;
        let parsed: ParallelSpawnArgs = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.group_id, "g1");
        assert_eq!(parsed.runs.len(), 2);
        assert_eq!(parsed.runs[0].run_id, "r1");
        assert_eq!(parsed.runs[1].parallel_index, 1);
        assert!(parsed.binary.is_none());
        assert!(parsed.permission_mode.is_none());
        assert!(parsed.allowed_tools.is_empty());
        assert!(parsed.disallowed_tools.is_empty());
    }

    #[test]
    fn parallel_run_spec_fields() {
        let spec = ParallelRunSpec {
            run_id: "run-42".to_string(),
            working_dir: "/worktrees/branch-p0".to_string(),
            parallel_index: 0,
        };
        assert_eq!(spec.run_id, "run-42");
        assert_eq!(spec.parallel_index, 0);
    }
}
