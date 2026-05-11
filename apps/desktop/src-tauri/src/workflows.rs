use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct StepRow {
    pub id: String,
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    pub ordinal: i64,
    pub name: String,
    #[serde(rename = "promptPrefix")]
    pub prompt_prefix: String,
    #[serde(rename = "providerOverride")]
    pub provider_override: Option<String>,
    #[serde(rename = "modelOverride")]
    pub model_override: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkflowRow {
    pub id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<StepRow>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct StepInput {
    pub id: Option<String>,
    pub ordinal: i64,
    pub name: String,
    #[serde(rename = "promptPrefix")]
    pub prompt_prefix: String,
    #[serde(rename = "providerOverride")]
    pub provider_override: Option<String>,
    #[serde(rename = "modelOverride")]
    pub model_override: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PhaseTemplateUpsertInput {
    pub id: Option<String>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<StepInput>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionRow {
    pub id: String,
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "stepId")]
    pub step_id: Option<String>,
    pub ordinal: i64,
    pub name: String,
    pub status: String,
    #[serde(rename = "providerRunId")]
    pub provider_run_id: Option<String>,
    #[serde(rename = "outputSummary")]
    pub output_summary: Option<String>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<String>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<String>,
    #[serde(rename = "providerSessionId")]
    pub provider_session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PhaseRunInsertInput {
    pub id: Option<String>,
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "stepId")]
    pub step_id: Option<String>,
    pub ordinal: i64,
    pub name: String,
    pub status: String,
    #[serde(rename = "providerRunId")]
    pub provider_run_id: Option<String>,
    #[serde(rename = "outputSummary")]
    pub output_summary: Option<String>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<String>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PhaseRunUpdateInput {
    pub id: String,
    pub status: String,
    #[serde(rename = "providerRunId")]
    pub provider_run_id: Option<String>,
    #[serde(rename = "outputSummary")]
    pub output_summary: Option<String>,
    #[serde(rename = "startedAt")]
    pub started_at: Option<String>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<String>,
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum PhaseError {
    #[error("db error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("db mutex poisoned")]
    Poisoned,
    #[error("workflow not found: {0}")]
    TemplateNotFound(String),
    #[error("agent not found: {0}")]
    RunNotFound(String),
}

impl Serialize for PhaseError {
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

impl PhaseError {
    fn kind(&self) -> &'static str {
        match self {
            PhaseError::Db(_) => "db",
            PhaseError::Poisoned => "poisoned",
            PhaseError::TemplateNotFound(_) => "template_not_found",
            PhaseError::RunNotFound(_) => "run_not_found",
        }
    }
}

impl From<DbError> for PhaseError {
    fn from(e: DbError) -> Self {
        match e {
            DbError::Sqlite(inner) => PhaseError::Db(inner),
            DbError::Poisoned => PhaseError::Poisoned,
            _ => PhaseError::Db(rusqlite::Error::InvalidQuery),
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn load_steps(
    conn: &rusqlite::Connection,
    workflow_id: &str,
) -> Result<Vec<StepRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override
         FROM steps
         WHERE workflow_id = ?1
         ORDER BY ordinal ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![workflow_id], |row| {
        Ok(StepRow {
            id: row.get(0)?,
            workflow_id: row.get(1)?,
            ordinal: row.get(2)?,
            name: row.get(3)?,
            prompt_prefix: row.get(4)?,
            provider_override: row.get(5)?,
            model_override: row.get(6)?,
        })
    })?;
    rows.collect()
}

fn row_to_template(
    conn: &rusqlite::Connection,
    id: String,
    workspace_id: String,
    name: String,
    description: String,
    created_at: String,
    updated_at: String,
) -> Result<WorkflowRow, rusqlite::Error> {
    let steps = load_steps(conn, &id)?;
    Ok(WorkflowRow {
        id,
        workspace_id,
        name,
        description,
        steps,
        created_at,
        updated_at,
    })
}

// ---------------------------------------------------------------------------
// Commands — workflow CRUD
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn workflow_list(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Vec<WorkflowRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, name, description, created_at, updated_at
         FROM workflows
         WHERE workspace_id = ?1
         ORDER BY created_at ASC",
    )?;
    let template_ids: Vec<(String, String, String, String, String, String)> = stmt
        .query_map(rusqlite::params![workspace_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(PhaseError::Db)?;

    let mut result = Vec::with_capacity(template_ids.len());
    for (id, ws, name, desc, created, updated) in template_ids {
        let template = row_to_template(&conn, id, ws, name, desc, created, updated)
            .map_err(PhaseError::Db)?;
        result.push(template);
    }
    Ok(result)
}

#[tauri::command]
pub fn workflow_get(
    state: State<'_, Db>,
    id: String,
) -> Result<Option<WorkflowRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, name, description, created_at, updated_at
         FROM workflows
         WHERE id = ?1
         LIMIT 1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
        ))
    })?;
    match rows.next() {
        Some(r) => {
            let (rid, ws, name, desc, created, updated) = r.map_err(PhaseError::Db)?;
            let template = row_to_template(&conn, rid, ws, name, desc, created, updated)
                .map_err(PhaseError::Db)?;
            Ok(Some(template))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn workflow_upsert(
    state: State<'_, Db>,
    input: PhaseTemplateUpsertInput,
) -> Result<WorkflowRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let now = iso_now();

    // Resolve id: use provided or look up by (workspace_id, name) or generate new.
    let id = if let Some(ref given_id) = input.id {
        given_id.clone()
    } else {
        let existing: Option<String> = {
            let mut stmt = conn.prepare(
                "SELECT id FROM workflows WHERE workspace_id = ?1 AND name = ?2 LIMIT 1",
            )?;
            let mut rows = stmt.query_map(
                rusqlite::params![input.workspace_id, input.name],
                |row| row.get(0),
            )?;
            match rows.next() {
                Some(r) => Some(r.map_err(PhaseError::Db)?),
                None => None,
            }
        };
        existing.unwrap_or_else(uuid_v4)
    };

    let created_at: String = {
        let mut stmt =
            conn.prepare("SELECT created_at FROM workflows WHERE id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| row.get(0))?;
        match rows.next() {
            Some(r) => r.map_err(PhaseError::Db)?,
            None => now.clone(),
        }
    };

    conn.execute(
        "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
           name        = excluded.name,
           description = excluded.description,
           updated_at  = excluded.updated_at",
        rusqlite::params![
            id,
            input.workspace_id,
            input.name,
            input.description,
            created_at,
            now,
        ],
    )?;

    // Replace steps atomically.
    conn.execute(
        "DELETE FROM steps WHERE workflow_id = ?1",
        rusqlite::params![id],
    )?;

    let mut steps = Vec::with_capacity(input.steps.len());
    for def in &input.steps {
        let def_id = def.id.clone().unwrap_or_else(uuid_v4);
        conn.execute(
            "INSERT INTO steps
               (id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                def_id,
                id,
                def.ordinal,
                def.name,
                def.prompt_prefix,
                def.provider_override,
                def.model_override,
            ],
        )?;
        steps.push(StepRow {
            id: def_id,
            workflow_id: id.clone(),
            ordinal: def.ordinal,
            name: def.name.clone(),
            prompt_prefix: def.prompt_prefix.clone(),
            provider_override: def.provider_override.clone(),
            model_override: def.model_override.clone(),
        });
    }

    Ok(WorkflowRow {
        id,
        workspace_id: input.workspace_id,
        name: input.name,
        description: input.description,
        steps,
        created_at,
        updated_at: now,
    })
}

#[tauri::command]
pub fn workflow_delete(
    state: State<'_, Db>,
    id: String,
) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;

    let exists: bool = {
        let mut stmt =
            conn.prepare("SELECT 1 FROM workflows WHERE id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![id], |_| Ok(()))?;
        rows.next().is_some()
    };

    if !exists {
        return Err(PhaseError::TemplateNotFound(id));
    }

    // Cascade delete handled by FK ON DELETE CASCADE on steps.
    conn.execute(
        "DELETE FROM workflows WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands — agent (= session row) lifecycle
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn session_list_for_task(
    state: State<'_, Db>,
    task_id: String,
) -> Result<Vec<SessionRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, task_id, step_id, ordinal, name, status,
                provider_run_id, output_summary, started_at, completed_at,
                provider_session_id
         FROM sessions
         WHERE task_id = ?1
         ORDER BY ordinal ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![task_id], |row| {
        Ok(SessionRow {
            id: row.get(0)?,
            task_id: row.get(1)?,
            step_id: row.get(2)?,
            ordinal: row.get(3)?,
            name: row.get(4)?,
            status: row.get(5)?,
            provider_run_id: row.get(6)?,
            output_summary: row.get(7)?,
            started_at: row.get(8)?,
            completed_at: row.get(9)?,
            provider_session_id: row.get(10)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

#[tauri::command]
pub fn session_insert(
    state: State<'_, Db>,
    input: PhaseRunInsertInput,
) -> Result<SessionRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let id = input.id.clone().unwrap_or_else(uuid_v4);

    conn.execute(
        "INSERT INTO sessions
           (id, task_id, step_id, ordinal, name, status,
            provider_run_id, output_summary, started_at, completed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            id,
            input.task_id,
            input.step_id,
            input.ordinal,
            input.name,
            input.status,
            input.provider_run_id,
            input.output_summary,
            input.started_at,
            input.completed_at,
        ],
    )?;

    Ok(SessionRow {
        id,
        task_id: input.task_id,
        step_id: input.step_id,
        ordinal: input.ordinal,
        name: input.name,
        status: input.status,
        provider_run_id: input.provider_run_id,
        output_summary: input.output_summary,
        started_at: input.started_at,
        completed_at: input.completed_at,
        provider_session_id: None,
    })
}

#[tauri::command]
pub fn session_update_status(
    state: State<'_, Db>,
    input: PhaseRunUpdateInput,
) -> Result<SessionRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;

    conn.execute(
        "UPDATE sessions SET
           status         = ?2,
           provider_run_id = COALESCE(?3, provider_run_id),
           output_summary  = COALESCE(?4, output_summary),
           started_at      = COALESCE(?5, started_at),
           completed_at    = COALESCE(?6, completed_at)
         WHERE id = ?1",
        rusqlite::params![
            input.id,
            input.status,
            input.provider_run_id,
            input.output_summary,
            input.started_at,
            input.completed_at,
        ],
    )?;

    // Fetch updated row.
    let mut stmt = conn.prepare(
        "SELECT id, task_id, step_id, ordinal, name, status,
                provider_run_id, output_summary, started_at, completed_at,
                provider_session_id
         FROM sessions
         WHERE id = ?1
         LIMIT 1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![input.id], |row| {
        Ok(SessionRow {
            id: row.get(0)?,
            task_id: row.get(1)?,
            step_id: row.get(2)?,
            ordinal: row.get(3)?,
            name: row.get(4)?,
            status: row.get(5)?,
            provider_run_id: row.get(6)?,
            output_summary: row.get(7)?,
            started_at: row.get(8)?,
            completed_at: row.get(9)?,
            provider_session_id: row.get(10)?,
        })
    })?;
    match rows.next() {
        Some(r) => Ok(r.map_err(PhaseError::Db)?),
        None => Err(PhaseError::RunNotFound(input.id)),
    }
}

// Persists the provider-side session id captured from the CLI's `system` init
// event (claude). Threaded back via `--resume <id>` on subsequent turns so the
// provider retains full prior-turn context across one-shot invocations.
#[tauri::command]
pub fn session_set_provider_session_id(
    state: State<'_, Db>,
    id: String,
    provider_session_id: String,
) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let affected = conn.execute(
        "UPDATE sessions SET provider_session_id = ?2 WHERE id = ?1",
        rusqlite::params![id, provider_session_id],
    )?;
    if affected == 0 {
        return Err(PhaseError::RunNotFound(id));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Utilities (mirrors skills.rs — kept independent per module)
// ---------------------------------------------------------------------------

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

fn iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let (year, month, day, hour, min, sec) = epoch_secs_to_datetime(secs);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
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
