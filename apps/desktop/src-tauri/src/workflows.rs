use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

type WorkflowTuple = (
    String,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    i64,
    i64,
    Option<i64>,
    i64,
    Option<String>,
);

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepRow {
    pub id: String,
    pub workflow_id: String,
    pub library_step_id: Option<String>,
    pub role: Option<String>,
    pub ordinal: i64,
    pub name: String,
    pub prompt_prefix: String,
    pub expected_output: Option<String>,
    pub provider_override: Option<String>,
    pub model_override: Option<String>,
    pub effort: Option<String>,
    pub verbosity: Option<String>,
    pub orchestrator_reason: Option<String>,
    pub routing_lock: Option<String>,
    pub routing_decision: Option<String>,
    pub task_profile: Option<String>,
    pub size: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepDefRow {
    pub id: String,
    pub workspace_id: Option<String>,
    pub role: String,
    pub name: String,
    pub prompt_prefix: String,
    pub provider_default: Option<String>,
    pub model_default: Option<String>,
    pub effort_default: Option<String>,
    pub verbosity_default: Option<String>,
    pub expected_output: Option<String>,
    pub base_step_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepDefUpsertInput {
    pub id: Option<String>,
    pub workspace_id: Option<String>,
    pub role: String,
    pub name: String,
    pub prompt_prefix: String,
    pub provider_default: Option<String>,
    pub model_default: Option<String>,
    pub effort_default: Option<String>,
    pub verbosity_default: Option<String>,
    #[serde(default)]
    pub expected_output: Option<String>,
    #[serde(default)]
    pub base_step_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRow {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub goal: Option<String>,
    pub process_text: Option<String>,
    pub steps: Vec<StepRow>,
    pub created_at: String,
    pub updated_at: String,
    // Epoch seconds when soft-deleted; None for live workflows. workflow_list
    // only returns live ones, but workflows_for_session may return deleted ones
    // still attached to a session.
    pub deleted_at: Option<i64>,
    // True for reusable presets; false for one-off custom workflows that a
    // session runs without being saved to the preset library.
    pub is_preset: bool,
    // How the workflow came to exist: 'library' (shipped), 'custom' (built by
    // hand) or 'orchestrated' (born from a dynamic run). None on rows written
    // before the column existed.
    pub origin: Option<String>,
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
    #[error("built-in step cannot be changed: {0}")]
    BuiltinStepReadOnly(String),
    #[error("a saved step needs a workspace")]
    StepDefWorkspaceRequired,
}

crate::util::impl_error_serialize!(PhaseError);

impl PhaseError {
    fn kind(&self) -> &'static str {
        match self {
            PhaseError::Db(_) => "db",
            PhaseError::Poisoned => "poisoned",
            PhaseError::TemplateNotFound(_) => "template_not_found",
            PhaseError::BuiltinStepReadOnly(_) => "builtin_step_read_only",
            PhaseError::StepDefWorkspaceRequired => "step_def_workspace_required",
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
        "SELECT id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix,
                expected_output, provider_override, model_override, effort, verbosity,
                orchestrator_reason, routing_lock, routing_decision, task_profile, size
         FROM steps
         WHERE workflow_id = ?1 AND deleted_at IS NULL
         ORDER BY ordinal ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![workflow_id], |row| {
        Ok(StepRow {
            id: row.get(0)?,
            workflow_id: row.get(1)?,
            library_step_id: row.get(2)?,
            role: row.get(3)?,
            ordinal: row.get(4)?,
            name: row.get(5)?,
            prompt_prefix: row.get(6)?,
            expected_output: row.get(7)?,
            provider_override: row.get(8)?,
            model_override: row.get(9)?,
            effort: row.get(10)?,
            verbosity: row.get(11)?,
            orchestrator_reason: row.get(12)?,
            routing_lock: row.get(13)?,
            routing_decision: row.get(14)?,
            task_profile: row.get(15)?,
            size: row.get(16)?,
        })
    })?;
    rows.collect()
}

#[allow(clippy::too_many_arguments)]
fn row_to_template(
    conn: &rusqlite::Connection,
    id: String,
    workspace_id: String,
    name: String,
    description: String,
    goal: Option<String>,
    process_text: Option<String>,
    created_at: i64,
    updated_at: i64,
    deleted_at: Option<i64>,
    is_preset: bool,
    origin: Option<String>,
) -> Result<WorkflowRow, rusqlite::Error> {
    let steps = load_steps(conn, &id)?;
    Ok(WorkflowRow {
        id,
        workspace_id,
        name,
        description,
        goal,
        process_text,
        steps,
        created_at: crate::util::ms_to_iso(created_at),
        updated_at: crate::util::ms_to_iso(updated_at),
        deleted_at,
        is_preset,
        origin,
    })
}

// ---------------------------------------------------------------------------
// Commands — workflow CRUD
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn workflow_list(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Vec<WorkflowRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, name, description, goal, process_text, created_at, updated_at,
                deleted_at, is_preset, origin
         FROM workflows
         WHERE workspace_id = ?1 AND deleted_at IS NULL AND is_preset = 1
         ORDER BY created_at ASC",
    )?;
    let template_ids: Vec<WorkflowTuple> = stmt
        .query_map(rusqlite::params![workspace_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
                row.get(10)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(PhaseError::Db)?;

    let mut result = Vec::with_capacity(template_ids.len());
    for (id, ws, name, desc, goal, process, created, updated, deleted, is_preset, origin) in
        template_ids
    {
        let template = row_to_template(
            &conn,
            id,
            ws,
            name,
            desc,
            goal,
            process,
            created,
            updated,
            deleted,
            is_preset != 0,
            origin,
        )
        .map_err(PhaseError::Db)?;
        result.push(template);
    }
    Ok(result)
}

/// Workflows attached to a session via `session_workflows`, INCLUDING ones that
/// have since been soft-deleted from the workspace preset list. The session that
/// started a workflow must keep seeing it even after it's deleted everywhere
/// else, so this is loaded in addition to `workflow_list`.
#[tauri::command]
pub async fn workflows_for_session(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Vec<WorkflowRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT w.id, w.workspace_id, w.name, w.description, w.goal, w.process_text, w.created_at,
                w.updated_at, w.deleted_at, w.is_preset, w.origin
         FROM workflows w
         JOIN session_workflows sw ON sw.workflow_id = w.id
         WHERE sw.session_id = ?1
         ORDER BY sw.ordinal ASC",
    )?;
    let rows: Vec<WorkflowTuple> = stmt
        .query_map(rusqlite::params![session_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
                row.get(10)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(PhaseError::Db)?;

    let mut result = Vec::with_capacity(rows.len());
    for (id, ws, name, desc, goal, process, created, updated, deleted, is_preset, origin) in rows {
        let template = row_to_template(
            &conn,
            id,
            ws,
            name,
            desc,
            goal,
            process,
            created,
            updated,
            deleted,
            is_preset != 0,
            origin,
        )
        .map_err(PhaseError::Db)?;
        result.push(template);
    }
    Ok(result)
}

// ---------------------------------------------------------------------------
// Commands — step library (reusable StepDef CRUD, soft-delete)
// ---------------------------------------------------------------------------

fn map_step_def_row(row: &rusqlite::Row<'_>) -> Result<StepDefRow, rusqlite::Error> {
    Ok(StepDefRow {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        role: row.get(2)?,
        name: row.get(3)?,
        prompt_prefix: row.get(4)?,
        provider_default: row.get(5)?,
        model_default: row.get(6)?,
        effort_default: row.get(7)?,
        verbosity_default: row.get(8)?,
        expected_output: row.get(9)?,
        base_step_id: row.get(10)?,
        created_at: crate::util::ms_to_iso(row.get(11)?),
        updated_at: crate::util::ms_to_iso(row.get(12)?),
    })
}

const STEP_DEF_COLS: &str = "id, workspace_id, role, name, prompt_prefix, provider_default, \
     model_default, effort_default, verbosity_default, expected_output, base_step_id, \
     created_at, updated_at";

const BUILTIN_STEP_PREFIX: &str = "seed_";

fn is_builtin_step_row(conn: &rusqlite::Connection, id: &str) -> Result<bool, PhaseError> {
    if id.starts_with(BUILTIN_STEP_PREFIX) {
        return Ok(true);
    }
    let mut stmt = conn.prepare("SELECT workspace_id FROM step_library WHERE id = ?1 LIMIT 1")?;
    let mut rows = stmt.query_map(rusqlite::params![id], |row| row.get::<_, Option<String>>(0))?;
    match rows.next() {
        Some(row) => Ok(row.map_err(PhaseError::Db)?.is_none()),
        None => Ok(false),
    }
}

fn list_step_defs(
    conn: &rusqlite::Connection,
    workspace_id: &str,
) -> Result<Vec<StepDefRow>, PhaseError> {
    let sql = format!(
        "SELECT {cols} FROM step_library
         WHERE deleted_at IS NULL
           AND workspace_id = ?1
         ORDER BY name ASC",
        cols = STEP_DEF_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![workspace_id], map_step_def_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

fn upsert_step_def(
    conn: &rusqlite::Connection,
    input: StepDefUpsertInput,
) -> Result<StepDefRow, PhaseError> {
    let workspace_id = match input.workspace_id.as_deref().map(str::trim) {
        Some(value) if !value.is_empty() => value.to_string(),
        _ => return Err(PhaseError::StepDefWorkspaceRequired),
    };
    let id = input.id.clone().unwrap_or_else(crate::util::uuid_v4);
    if is_builtin_step_row(conn, &id)? {
        return Err(PhaseError::BuiltinStepReadOnly(id));
    }
    let now_ms = crate::util::now_ms();
    let now = crate::util::ms_to_iso(now_ms);
    let created_at_ms: i64 = {
        let mut stmt = conn.prepare("SELECT created_at FROM step_library WHERE id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| row.get(0))?;
        match rows.next() {
            Some(r) => r.map_err(PhaseError::Db)?,
            None => now_ms,
        }
    };

    conn.execute(
        "INSERT INTO step_library
           (id, workspace_id, role, name, prompt_prefix,
            provider_default, model_default, effort_default, verbosity_default,
            expected_output, base_step_id,
            created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL)
         ON CONFLICT(id) DO UPDATE SET
           workspace_id      = excluded.workspace_id,
           role              = excluded.role,
           name              = excluded.name,
           prompt_prefix     = excluded.prompt_prefix,
           provider_default  = excluded.provider_default,
           model_default     = excluded.model_default,
           effort_default    = excluded.effort_default,
           verbosity_default = excluded.verbosity_default,
           expected_output   = excluded.expected_output,
           base_step_id      = excluded.base_step_id,
           updated_at        = excluded.updated_at,
           deleted_at        = NULL",
        rusqlite::params![
            id,
            workspace_id,
            input.role,
            input.name,
            input.prompt_prefix,
            input.provider_default,
            input.model_default,
            input.effort_default,
            input.verbosity_default,
            input.expected_output,
            input.base_step_id,
            created_at_ms,
            now_ms,
        ],
    )?;

    Ok(StepDefRow {
        id,
        workspace_id: Some(workspace_id),
        role: input.role,
        name: input.name,
        prompt_prefix: input.prompt_prefix,
        provider_default: input.provider_default,
        model_default: input.model_default,
        effort_default: input.effort_default,
        verbosity_default: input.verbosity_default,
        expected_output: input.expected_output,
        base_step_id: input.base_step_id,
        created_at: crate::util::ms_to_iso(created_at_ms),
        updated_at: now,
    })
}

fn delete_step_def(conn: &rusqlite::Connection, id: &str) -> Result<(), PhaseError> {
    if is_builtin_step_row(conn, id)? {
        return Err(PhaseError::BuiltinStepReadOnly(id.to_string()));
    }
    let affected = conn.execute(
        "UPDATE step_library SET deleted_at = ?2 WHERE id = ?1",
        rusqlite::params![id, crate::util::now_ms()],
    )?;
    if affected == 0 {
        return Err(PhaseError::TemplateNotFound(id.to_string()));
    }
    Ok(())
}

#[tauri::command]
pub async fn step_def_list(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Vec<StepDefRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    list_step_defs(&conn, &workspace_id)
}

#[tauri::command]
pub async fn step_def_upsert(
    state: State<'_, Db>,
    input: StepDefUpsertInput,
) -> Result<StepDefRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    upsert_step_def(&conn, input)
}

#[tauri::command]
pub async fn step_def_delete(state: State<'_, Db>, id: String) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    delete_step_def(&conn, &id)
}

// Returns the set of workspace ids that contain at least one agent whose
// terminal turn hasn't been viewed yet. The sidebar uses this to pulse the
// workspace dot even for workspaces the user isn't currently on (their tasks
// are not loaded in memory there).
#[tauri::command]
pub async fn workspaces_with_unread(state: State<'_, Db>) -> Result<Vec<String>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT DISTINCT t.workspace_id
         FROM live_agents a
         JOIN sessions t ON a.session_id = t.id
         WHERE a.last_finished_at IS NOT NULL
           AND a.status != 'skipped'
           AND a.done_at IS NULL
           AND (a.last_viewed_at IS NULL OR a.last_finished_at > a.last_viewed_at)
           AND t.archived_at IS NULL
           AND t.deleted_at IS NULL",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn step_library_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE step_library (
                id TEXT PRIMARY KEY, workspace_id TEXT, role TEXT NOT NULL DEFAULT 'custom',
                name TEXT NOT NULL, prompt_prefix TEXT NOT NULL DEFAULT '',
                provider_default TEXT, model_default TEXT, effort_default TEXT,
                verbosity_default TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
                deleted_at INTEGER, expected_output TEXT, base_step_id TEXT
            );
            INSERT INTO step_library (id, workspace_id, role, name, created_at, updated_at, deleted_at)
              VALUES ('seed_scout', NULL, 'scout', 'Scout', 1, 1, 1);
            INSERT INTO step_library (id, workspace_id, role, name, created_at, updated_at)
              VALUES ('legacy-global', NULL, 'custom', 'Legacy', 1, 1);",
        )
        .unwrap();
        conn
    }

    fn step_input(id: Option<&str>, workspace_id: Option<&str>) -> StepDefUpsertInput {
        StepDefUpsertInput {
            id: id.map(str::to_string),
            workspace_id: workspace_id.map(str::to_string),
            role: "tester".to_string(),
            name: "Dry run replay".to_string(),
            prompt_prefix: "Replay settled batches.".to_string(),
            provider_default: None,
            model_default: None,
            effort_default: None,
            verbosity_default: None,
            expected_output: Some("A replay log".to_string()),
            base_step_id: Some("seed_tester".to_string()),
        }
    }

    #[test]
    fn step_def_upsert_refuses_a_step_without_a_workspace() {
        let conn = step_library_conn();
        assert!(matches!(
            upsert_step_def(&conn, step_input(None, None)),
            Err(PhaseError::StepDefWorkspaceRequired)
        ));
        assert!(matches!(
            upsert_step_def(&conn, step_input(None, Some("  "))),
            Err(PhaseError::StepDefWorkspaceRequired)
        ));
    }

    #[test]
    fn step_def_upsert_refuses_to_overwrite_a_built_in_step() {
        let conn = step_library_conn();
        assert!(matches!(
            upsert_step_def(&conn, step_input(Some("seed_scout"), Some("ws1"))),
            Err(PhaseError::BuiltinStepReadOnly(_))
        ));
        assert!(matches!(
            upsert_step_def(&conn, step_input(Some("legacy-global"), Some("ws1"))),
            Err(PhaseError::BuiltinStepReadOnly(_))
        ));
    }

    #[test]
    fn step_def_upsert_keeps_expected_output_and_base_step() {
        let conn = step_library_conn();
        let saved = upsert_step_def(&conn, step_input(None, Some("ws1"))).unwrap();
        let listed = list_step_defs(&conn, "ws1").unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, saved.id);
        assert_eq!(listed[0].expected_output.as_deref(), Some("A replay log"));
        assert_eq!(listed[0].base_step_id.as_deref(), Some("seed_tester"));
    }

    #[test]
    fn step_def_upsert_updates_the_same_row_by_id() {
        let conn = step_library_conn();
        let saved = upsert_step_def(&conn, step_input(None, Some("ws1"))).unwrap();
        let mut renamed = step_input(Some(&saved.id), Some("ws1"));
        renamed.name = "Replay".to_string();
        upsert_step_def(&conn, renamed).unwrap();
        let listed = list_step_defs(&conn, "ws1").unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "Replay");
    }

    #[test]
    fn step_def_list_skips_global_rows() {
        let conn = step_library_conn();
        assert!(list_step_defs(&conn, "ws1").unwrap().is_empty());
    }

    #[test]
    fn step_def_delete_refuses_a_built_in_step() {
        let conn = step_library_conn();
        assert!(matches!(
            delete_step_def(&conn, "seed_scout"),
            Err(PhaseError::BuiltinStepReadOnly(_))
        ));
        let saved = upsert_step_def(&conn, step_input(None, Some("ws1"))).unwrap();
        delete_step_def(&conn, &saved.id).unwrap();
        assert!(list_step_defs(&conn, "ws1").unwrap().is_empty());
    }
}

#[cfg(test)]
mod wire_shape_tests {
    use super::*;

    fn assert_roundtrip<T: serde::de::DeserializeOwned + Serialize>(json: &str) {
        let value: T = serde_json::from_str(json).unwrap();
        assert_eq!(serde_json::to_string(&value).unwrap(), json);
    }

    fn assert_debug_fields(debug: &str, pairs: &[(&str, &str)]) {
        for (field, value) in pairs {
            let needle = format!("{field}: {value}");
            assert!(debug.contains(&needle), "missing {needle} in {debug}");
        }
    }

    #[test]
    fn step_row_wire_json_is_pinned() {
        assert_roundtrip::<StepRow>(
            r#"{"id":"v_id","workflowId":"v_workflowId","libraryStepId":"v_libraryStepId","role":"v_role","ordinal":7,"name":"v_name","promptPrefix":"v_promptPrefix","expectedOutput":"v_expectedOutput","providerOverride":"v_providerOverride","modelOverride":"v_modelOverride","effort":"v_effort","verbosity":"v_verbosity","orchestratorReason":"v_orchestratorReason","routingLock":"v_routingLock","routingDecision":"v_routingDecision","taskProfile":"v_taskProfile","size":"v_size"}"#,
        );
    }

    #[test]
    fn step_def_row_wire_json_is_pinned() {
        assert_roundtrip::<StepDefRow>(
            r#"{"id":"v_id","workspaceId":"v_workspaceId","role":"v_role","name":"v_name","promptPrefix":"v_promptPrefix","providerDefault":"v_providerDefault","modelDefault":"v_modelDefault","effortDefault":"v_effortDefault","verbosityDefault":"v_verbosityDefault","expectedOutput":"v_expectedOutput","baseStepId":"v_baseStepId","createdAt":"v_createdAt","updatedAt":"v_updatedAt"}"#,
        );
    }

    #[test]
    fn step_def_upsert_input_reads_the_pinned_wire_keys() {
        let value: StepDefUpsertInput = serde_json::from_str(r#"{"id":"v_id","workspaceId":"v_workspaceId","role":"v_role","name":"v_name","promptPrefix":"v_promptPrefix","providerDefault":"v_providerDefault","modelDefault":"v_modelDefault","effortDefault":"v_effortDefault","verbosityDefault":"v_verbosityDefault","expectedOutput":"v_expectedOutput","baseStepId":"v_baseStepId"}"#).unwrap();
        assert_debug_fields(
            &format!("{value:?}"),
            &[
                ("id", "Some(\"v_id\")"),
                ("workspace_id", "Some(\"v_workspaceId\")"),
                ("role", "\"v_role\""),
                ("name", "\"v_name\""),
                ("prompt_prefix", "\"v_promptPrefix\""),
                ("provider_default", "Some(\"v_providerDefault\")"),
                ("model_default", "Some(\"v_modelDefault\")"),
                ("effort_default", "Some(\"v_effortDefault\")"),
                ("verbosity_default", "Some(\"v_verbosityDefault\")"),
                ("expected_output", "Some(\"v_expectedOutput\")"),
                ("base_step_id", "Some(\"v_baseStepId\")"),
            ],
        );
    }

    #[test]
    fn workflow_row_wire_json_is_pinned() {
        assert_roundtrip::<WorkflowRow>(
            r#"{"id":"v_id","workspaceId":"v_workspaceId","name":"v_name","description":"v_description","goal":"v_goal","processText":"v_processText","steps":[{"id":"v_id","workflowId":"v_workflowId","libraryStepId":"v_libraryStepId","role":"v_role","ordinal":7,"name":"v_name","promptPrefix":"v_promptPrefix","expectedOutput":"v_expectedOutput","providerOverride":"v_providerOverride","modelOverride":"v_modelOverride","effort":"v_effort","verbosity":"v_verbosity","orchestratorReason":"v_orchestratorReason","routingLock":"v_routingLock","routingDecision":"v_routingDecision","taskProfile":"v_taskProfile","size":"v_size"}],"createdAt":"v_createdAt","updatedAt":"v_updatedAt","deletedAt":9,"isPreset":true,"origin":"v_origin"}"#,
        );
    }
}
