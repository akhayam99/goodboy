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
    #[serde(rename = "libraryStepId")]
    pub library_step_id: Option<String>,
    pub role: Option<String>,
    pub ordinal: i64,
    pub name: String,
    #[serde(rename = "promptPrefix")]
    pub prompt_prefix: String,
    #[serde(rename = "providerOverride")]
    pub provider_override: Option<String>,
    #[serde(rename = "modelOverride")]
    pub model_override: Option<String>,
    pub effort: Option<String>,
    pub verbosity: Option<String>,
    #[serde(rename = "parallelGroup")]
    pub parallel_group: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StepDefRow {
    pub id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<String>,
    #[serde(rename = "baseStepId")]
    pub base_step_id: Option<String>,
    pub role: String,
    pub name: String,
    #[serde(rename = "promptPrefix")]
    pub prompt_prefix: String,
    #[serde(rename = "providerDefault")]
    pub provider_default: Option<String>,
    #[serde(rename = "modelDefault")]
    pub model_default: Option<String>,
    #[serde(rename = "effortDefault")]
    pub effort_default: Option<String>,
    #[serde(rename = "verbosityDefault")]
    pub verbosity_default: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct StepDefUpsertInput {
    pub id: Option<String>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<String>,
    #[serde(rename = "baseStepId")]
    pub base_step_id: Option<String>,
    pub role: String,
    pub name: String,
    #[serde(rename = "promptPrefix")]
    pub prompt_prefix: String,
    #[serde(rename = "providerDefault")]
    pub provider_default: Option<String>,
    #[serde(rename = "modelDefault")]
    pub model_default: Option<String>,
    #[serde(rename = "effortDefault")]
    pub effort_default: Option<String>,
    #[serde(rename = "verbosityDefault")]
    pub verbosity_default: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkflowRow {
    pub id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub goal: Option<String>,
    pub steps: Vec<StepRow>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    // Epoch seconds when soft-deleted; None for live workflows. workflow_list
    // only returns live ones, but workflows_for_session may return deleted ones
    // still attached to a session.
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<i64>,
    // True for reusable presets; false for one-off custom workflows that a
    // session runs without being saved to the preset library.
    #[serde(rename = "isPreset")]
    pub is_preset: bool,
}

#[derive(Debug, Deserialize)]
pub struct StepInput {
    pub id: Option<String>,
    #[serde(rename = "libraryStepId")]
    pub library_step_id: Option<String>,
    pub role: Option<String>,
    pub ordinal: i64,
    pub name: String,
    #[serde(rename = "promptPrefix")]
    pub prompt_prefix: String,
    #[serde(rename = "providerOverride")]
    pub provider_override: Option<String>,
    #[serde(rename = "modelOverride")]
    pub model_override: Option<String>,
    pub effort: Option<String>,
    pub verbosity: Option<String>,
    #[serde(rename = "parallelGroup")]
    pub parallel_group: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct PhaseTemplateUpsertInput {
    pub id: Option<String>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub goal: Option<String>,
    pub steps: Vec<StepInput>,
    // Defaults to true when omitted so existing callers keep producing presets.
    #[serde(rename = "isPreset", default = "default_true")]
    pub is_preset: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionRow {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
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
    #[serde(rename = "lastFinishedAt")]
    pub last_finished_at: Option<String>,
    #[serde(rename = "lastViewedAt")]
    pub last_viewed_at: Option<String>,
    pub kind: Option<String>,
    pub verbosity: Option<String>,
    #[serde(rename = "parentAgentId")]
    pub parent_agent_id: Option<String>,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "sourceThreadId")]
    pub source_thread_id: Option<String>,
    #[serde(rename = "sourceCommentUrl")]
    pub source_comment_url: Option<String>,
    #[serde(rename = "sourceKind")]
    pub source_kind: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PhaseRunInsertInput {
    pub id: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: String,
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
    pub kind: Option<String>,
    pub verbosity: Option<String>,
    #[serde(rename = "parentAgentId")]
    pub parent_agent_id: Option<String>,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "sourceThreadId")]
    pub source_thread_id: Option<String>,
    #[serde(rename = "sourceCommentUrl")]
    pub source_comment_url: Option<String>,
    #[serde(rename = "sourceKind")]
    pub source_kind: Option<String>,
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

crate::util::impl_error_serialize!(PhaseError);

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
        "SELECT id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix,
                provider_override, model_override, effort, verbosity, parallel_group
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
            provider_override: row.get(7)?,
            model_override: row.get(8)?,
            effort: row.get(9)?,
            verbosity: row.get(10)?,
            parallel_group: row.get(11)?,
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
    created_at: String,
    updated_at: String,
    deleted_at: Option<i64>,
    is_preset: bool,
) -> Result<WorkflowRow, rusqlite::Error> {
    let steps = load_steps(conn, &id)?;
    Ok(WorkflowRow {
        id,
        workspace_id,
        name,
        description,
        goal,
        steps,
        created_at,
        updated_at,
        deleted_at,
        is_preset,
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
        "SELECT id, workspace_id, name, description, goal, created_at, updated_at, deleted_at, is_preset
         FROM workflows
         WHERE workspace_id = ?1 AND deleted_at IS NULL AND is_preset = 1
         ORDER BY created_at ASC",
    )?;
    let template_ids: Vec<(
        String,
        String,
        String,
        String,
        Option<String>,
        String,
        String,
        Option<i64>,
        i64,
    )> = stmt
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
            ))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(PhaseError::Db)?;

    let mut result = Vec::with_capacity(template_ids.len());
    for (id, ws, name, desc, goal, created, updated, deleted, is_preset) in template_ids {
        let template = row_to_template(
            &conn, id, ws, name, desc, goal, created, updated, deleted, is_preset != 0,
        )
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
        "SELECT id, workspace_id, name, description, goal, created_at, updated_at, deleted_at, is_preset
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
            row.get::<_, Option<String>>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, Option<i64>>(7)?,
            row.get::<_, i64>(8)?,
        ))
    })?;
    match rows.next() {
        Some(r) => {
            let (rid, ws, name, desc, goal, created, updated, deleted, is_preset) =
                r.map_err(PhaseError::Db)?;
            let template = row_to_template(
                &conn, rid, ws, name, desc, goal, created, updated, deleted, is_preset != 0,
            )
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
    let now = crate::util::iso_now();

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
        existing.unwrap_or_else(crate::util::uuid_v4)
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
        "INSERT INTO workflows (id, workspace_id, name, description, goal, created_at, updated_at, is_preset)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
           name        = excluded.name,
           description = excluded.description,
           goal        = excluded.goal,
           updated_at  = excluded.updated_at,
           is_preset   = excluded.is_preset,
           deleted_at  = NULL",
        rusqlite::params![
            id,
            input.workspace_id,
            input.name,
            input.description,
            input.goal,
            created_at,
            now,
            input.is_preset as i32,
        ],
    )?;

    // Diff-based step persistence. We must PRESERVE step ids across edits:
    // agents.step_id references steps(id), so deleting + reinserting (the old
    // behaviour) silently nulled the linkage of every agent in every session
    // that had run this preset. Instead: upsert provided steps by id, and
    // soft-delete the ones the user removed.
    let mut kept_ids: Vec<String> = Vec::with_capacity(input.steps.len());
    let mut steps = Vec::with_capacity(input.steps.len());
    for def in &input.steps {
        let def_id = def.id.clone().unwrap_or_else(crate::util::uuid_v4);
        conn.execute(
            "INSERT INTO steps
               (id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix,
                provider_override, model_override, effort, verbosity, parallel_group, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL)
             ON CONFLICT(id) DO UPDATE SET
               workflow_id      = excluded.workflow_id,
               library_step_id  = excluded.library_step_id,
               role             = excluded.role,
               ordinal          = excluded.ordinal,
               name             = excluded.name,
               prompt_prefix    = excluded.prompt_prefix,
               provider_override = excluded.provider_override,
               model_override   = excluded.model_override,
               effort           = excluded.effort,
               verbosity        = excluded.verbosity,
               parallel_group   = excluded.parallel_group,
               deleted_at       = NULL",
            rusqlite::params![
                def_id,
                id,
                def.library_step_id,
                def.role,
                def.ordinal,
                def.name,
                def.prompt_prefix,
                def.provider_override,
                def.model_override,
                def.effort,
                def.verbosity,
                def.parallel_group,
            ],
        )?;
        kept_ids.push(def_id.clone());
        steps.push(StepRow {
            id: def_id,
            workflow_id: id.clone(),
            library_step_id: def.library_step_id.clone(),
            role: def.role.clone(),
            ordinal: def.ordinal,
            name: def.name.clone(),
            prompt_prefix: def.prompt_prefix.clone(),
            provider_override: def.provider_override.clone(),
            model_override: def.model_override.clone(),
            effort: def.effort.clone(),
            verbosity: def.verbosity.clone(),
            parallel_group: def.parallel_group,
        });
    }

    // Soft-delete instances the user removed from the workflow (keep the rows
    // so agents that ran them retain their step linkage / history).
    let placeholders = if kept_ids.is_empty() {
        "''".to_string()
    } else {
        kept_ids
            .iter()
            .map(|_| "?".to_string())
            .collect::<Vec<_>>()
            .join(",")
    };
    let sql = format!(
        "UPDATE steps SET deleted_at = strftime('%s','now')
         WHERE workflow_id = ?1 AND deleted_at IS NULL AND id NOT IN ({})",
        placeholders
    );
    let mut params: Vec<&dyn rusqlite::ToSql> = Vec::with_capacity(kept_ids.len() + 1);
    params.push(&id);
    for k in &kept_ids {
        params.push(k);
    }
    conn.execute(&sql, params.as_slice())?;

    Ok(WorkflowRow {
        id,
        workspace_id: input.workspace_id,
        name: input.name,
        description: input.description,
        goal: input.goal,
        steps,
        created_at,
        updated_at: now,
        deleted_at: None,
        is_preset: input.is_preset,
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

    // Seeded presets keep a deterministic id so "Restore defaults" can re-seed
    // them; never hard-delete those (the row must survive to be un-deleted).
    let is_seed = id.starts_with("wf_seed_");

    // A workflow attached to any session must survive a hard DELETE: dropping its
    // steps would null the step linkage of every agent that ran it, and the
    // session would lose its workflow view entirely.
    let is_attached: bool = {
        let mut stmt =
            conn.prepare("SELECT 1 FROM session_workflows WHERE workflow_id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![id], |_| Ok(()))?;
        rows.next().is_some()
    };

    if is_seed || is_attached {
        // Soft-delete: hide it from the preset picker while keeping seeded rows
        // restorable and attached sessions fully intact.
        conn.execute(
            "UPDATE workflows SET deleted_at = strftime('%s','now') WHERE id = ?1",
            rusqlite::params![id],
        )?;
    } else {
        // User-created and unreferenced: hard-delete so deleted drafts/presets do
        // not accumulate as hidden rows.
        conn.execute(
            "DELETE FROM steps WHERE workflow_id = ?1",
            rusqlite::params![id],
        )?;
        conn.execute("DELETE FROM workflows WHERE id = ?1", rusqlite::params![id])?;
    }
    Ok(())
}

/// Workflows attached to a session via `session_workflows`, INCLUDING ones that
/// have since been soft-deleted from the workspace preset list. The session that
/// started a workflow must keep seeing it even after it's deleted everywhere
/// else, so this is loaded in addition to `workflow_list`.
#[tauri::command]
pub fn workflows_for_session(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Vec<WorkflowRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT w.id, w.workspace_id, w.name, w.description, w.goal, w.created_at, w.updated_at,
                w.deleted_at, w.is_preset
         FROM workflows w
         JOIN session_workflows sw ON sw.workflow_id = w.id
         WHERE sw.session_id = ?1
         ORDER BY sw.ordinal ASC",
    )?;
    let rows: Vec<(
        String,
        String,
        String,
        String,
        Option<String>,
        String,
        String,
        Option<i64>,
        i64,
    )> = stmt
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
            ))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(PhaseError::Db)?;

    let mut result = Vec::with_capacity(rows.len());
    for (id, ws, name, desc, goal, created, updated, deleted, is_preset) in rows {
        let template = row_to_template(
            &conn, id, ws, name, desc, goal, created, updated, deleted, is_preset != 0,
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
        base_step_id: row.get(2)?,
        role: row.get(3)?,
        name: row.get(4)?,
        prompt_prefix: row.get(5)?,
        provider_default: row.get(6)?,
        model_default: row.get(7)?,
        effort_default: row.get(8)?,
        verbosity_default: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

const STEP_DEF_COLS: &str =
    "id, workspace_id, base_step_id, role, name, prompt_prefix, provider_default, \
     model_default, effort_default, verbosity_default, created_at, updated_at";

/// The effective library for a workspace: every non-deleted global seed plus the
/// workspace's own non-deleted steps. A workspace override (a local row with
/// `base_step_id` pointing at a global) shadows that global, so the global is
/// filtered out when an override exists.
#[tauri::command]
pub fn step_def_list(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Vec<StepDefRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let sql = format!(
        "SELECT {cols} FROM step_library
         WHERE deleted_at IS NULL
           AND (
             workspace_id = ?1
             OR (
               workspace_id IS NULL
               AND id NOT IN (
                 SELECT base_step_id FROM step_library
                 WHERE workspace_id = ?1 AND base_step_id IS NOT NULL AND deleted_at IS NULL
               )
             )
           )
         ORDER BY (workspace_id IS NULL) DESC, name ASC",
        cols = STEP_DEF_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![workspace_id], map_step_def_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

#[tauri::command]
pub fn step_def_upsert(
    state: State<'_, Db>,
    input: StepDefUpsertInput,
) -> Result<StepDefRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let now = crate::util::iso_now();
    let id = input.id.clone().unwrap_or_else(crate::util::uuid_v4);
    let created_at: String = {
        let mut stmt =
            conn.prepare("SELECT created_at FROM step_library WHERE id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| row.get(0))?;
        match rows.next() {
            Some(r) => r.map_err(PhaseError::Db)?,
            None => now.clone(),
        }
    };

    conn.execute(
        "INSERT INTO step_library
           (id, workspace_id, base_step_id, role, name, prompt_prefix,
            provider_default, model_default, effort_default, verbosity_default,
            created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL)
         ON CONFLICT(id) DO UPDATE SET
           workspace_id      = excluded.workspace_id,
           base_step_id      = excluded.base_step_id,
           role              = excluded.role,
           name              = excluded.name,
           prompt_prefix     = excluded.prompt_prefix,
           provider_default  = excluded.provider_default,
           model_default     = excluded.model_default,
           effort_default    = excluded.effort_default,
           verbosity_default = excluded.verbosity_default,
           updated_at        = excluded.updated_at,
           deleted_at        = NULL",
        rusqlite::params![
            id,
            input.workspace_id,
            input.base_step_id,
            input.role,
            input.name,
            input.prompt_prefix,
            input.provider_default,
            input.model_default,
            input.effort_default,
            input.verbosity_default,
            created_at,
            now,
        ],
    )?;

    Ok(StepDefRow {
        id,
        workspace_id: input.workspace_id,
        base_step_id: input.base_step_id,
        role: input.role,
        name: input.name,
        prompt_prefix: input.prompt_prefix,
        provider_default: input.provider_default,
        model_default: input.model_default,
        effort_default: input.effort_default,
        verbosity_default: input.verbosity_default,
        created_at,
        updated_at: now,
    })
}

/// Soft-delete a library step. Workflows that already instanced it keep their
/// `steps` rows (the instance carries its own copy), so existing presets are
/// unaffected; the def just stops appearing in the library picker.
#[tauri::command]
pub fn step_def_delete(state: State<'_, Db>, id: String) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let affected = conn.execute(
        "UPDATE step_library SET deleted_at = strftime('%s','now') WHERE id = ?1",
        rusqlite::params![id],
    )?;
    if affected == 0 {
        return Err(PhaseError::TemplateNotFound(id));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands — agent (= session row) lifecycle
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn agent_list_for_session(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Vec<SessionRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, session_id, step_id, ordinal, name, status,
                provider_run_id, output_summary, started_at, completed_at,
                provider_session_id, last_finished_at, last_viewed_at, kind, verbosity,
                parent_agent_id, workflow_run_id, source_thread_id, source_comment_url,
                source_kind
         FROM agents
         WHERE session_id = ?1
         ORDER BY ordinal ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![session_id], |row| {
        Ok(SessionRow {
            id: row.get(0)?,
            session_id: row.get(1)?,
            step_id: row.get(2)?,
            ordinal: row.get(3)?,
            name: row.get(4)?,
            status: row.get(5)?,
            provider_run_id: row.get(6)?,
            output_summary: row.get(7)?,
            started_at: row.get(8)?,
            completed_at: row.get(9)?,
            provider_session_id: row.get(10)?,
            last_finished_at: row.get(11)?,
            last_viewed_at: row.get(12)?,
            kind: row.get(13)?,
            verbosity: row.get(14)?,
            parent_agent_id: row.get(15)?,
            workflow_run_id: row.get(16)?,
            source_thread_id: row.get(17)?,
            source_comment_url: row.get(18)?,
            source_kind: row.get(19)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

#[tauri::command]
pub fn agent_insert(
    state: State<'_, Db>,
    input: PhaseRunInsertInput,
) -> Result<SessionRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let id = input.id.clone().unwrap_or_else(crate::util::uuid_v4);

    conn.execute(
        "INSERT INTO agents
           (id, session_id, step_id, ordinal, name, status,
            provider_run_id, output_summary, started_at, completed_at, kind, verbosity,
            parent_agent_id, workflow_run_id, source_thread_id, source_comment_url, source_kind)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        rusqlite::params![
            id,
            input.session_id,
            input.step_id,
            input.ordinal,
            input.name,
            input.status,
            input.provider_run_id,
            input.output_summary,
            input.started_at,
            input.completed_at,
            input.kind,
            input.verbosity,
            input.parent_agent_id,
            input.workflow_run_id,
            input.source_thread_id,
            input.source_comment_url,
            input.source_kind,
        ],
    )?;

    Ok(SessionRow {
        id,
        session_id: input.session_id,
        step_id: input.step_id,
        ordinal: input.ordinal,
        name: input.name,
        status: input.status,
        provider_run_id: input.provider_run_id,
        output_summary: input.output_summary,
        started_at: input.started_at,
        completed_at: input.completed_at,
        provider_session_id: None,
        last_finished_at: None,
        last_viewed_at: None,
        kind: input.kind,
        verbosity: input.verbosity,
        parent_agent_id: input.parent_agent_id,
        workflow_run_id: input.workflow_run_id,
        source_thread_id: input.source_thread_id,
        source_comment_url: input.source_comment_url,
        source_kind: input.source_kind,
    })
}

#[tauri::command]
pub fn agent_update_status(
    state: State<'_, Db>,
    input: PhaseRunUpdateInput,
) -> Result<SessionRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;

    // When status transitions to a terminal state, also stamp `last_finished_at`
    // so the sidebar can show an unread indicator until the user views the
    // agent (which stamps `last_viewed_at` via `agent_mark_viewed`).
    let is_terminal = matches!(input.status.as_str(), "completed" | "failed" | "skipped");
    conn.execute(
        "UPDATE agents SET
           status         = ?2,
           provider_run_id = COALESCE(?3, provider_run_id),
           output_summary  = COALESCE(?4, output_summary),
           started_at      = COALESCE(?5, started_at),
           completed_at    = COALESCE(?6, completed_at),
           last_finished_at = CASE WHEN ?7 = 1
             THEN COALESCE(?6, last_finished_at, CURRENT_TIMESTAMP)
             ELSE last_finished_at END
         WHERE id = ?1",
        rusqlite::params![
            input.id,
            input.status,
            input.provider_run_id,
            input.output_summary,
            input.started_at,
            input.completed_at,
            is_terminal as i32,
        ],
    )?;

    // Fetch updated row.
    let mut stmt = conn.prepare(
        "SELECT id, session_id, step_id, ordinal, name, status,
                provider_run_id, output_summary, started_at, completed_at,
                provider_session_id, last_finished_at, last_viewed_at, kind, verbosity,
                parent_agent_id, workflow_run_id, source_thread_id, source_comment_url,
                source_kind
         FROM agents
         WHERE id = ?1
         LIMIT 1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![input.id], |row| {
        Ok(SessionRow {
            id: row.get(0)?,
            session_id: row.get(1)?,
            step_id: row.get(2)?,
            ordinal: row.get(3)?,
            name: row.get(4)?,
            status: row.get(5)?,
            provider_run_id: row.get(6)?,
            output_summary: row.get(7)?,
            started_at: row.get(8)?,
            completed_at: row.get(9)?,
            provider_session_id: row.get(10)?,
            last_finished_at: row.get(11)?,
            last_viewed_at: row.get(12)?,
            kind: row.get(13)?,
            verbosity: row.get(14)?,
            parent_agent_id: row.get(15)?,
            workflow_run_id: row.get(16)?,
            source_thread_id: row.get(17)?,
            source_comment_url: row.get(18)?,
            source_kind: row.get(19)?,
        })
    })?;
    match rows.next() {
        Some(r) => Ok(r.map_err(PhaseError::Db)?),
        None => Err(PhaseError::RunNotFound(input.id)),
    }
}

// Persists the agent role kind (planner/scout/implementer/...) so the
// chip survives an app restart. agentKindOverride in the store mirrors
// this column; both are kept in sync via this command.
#[tauri::command]
pub fn agent_set_kind(
    state: State<'_, Db>,
    id: String,
    kind: Option<String>,
) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let affected = conn.execute(
        "UPDATE agents SET kind = ?2 WHERE id = ?1",
        rusqlite::params![id, kind],
    )?;
    if affected == 0 {
        return Err(PhaseError::RunNotFound(id));
    }
    Ok(())
}

// Persists the agent-level verbosity override. NULL = inherit from workspace.
#[tauri::command]
pub fn agent_set_verbosity(
    state: State<'_, Db>,
    id: String,
    verbosity: Option<String>,
) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let affected = conn.execute(
        "UPDATE agents SET verbosity = ?2 WHERE id = ?1",
        rusqlite::params![id, verbosity],
    )?;
    if affected == 0 {
        return Err(PhaseError::RunNotFound(id));
    }
    Ok(())
}

// Persists the provider-side session id captured from the CLI's `system` init
// event (claude). Threaded back via `--resume <id>` on subsequent turns so the
// provider retains full prior-turn context across one-shot invocations.
#[tauri::command]
pub fn agent_set_provider_session_id(
    state: State<'_, Db>,
    id: String,
    provider_session_id: String,
) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let affected = conn.execute(
        "UPDATE agents SET provider_session_id = ?2 WHERE id = ?1",
        rusqlite::params![id, provider_session_id],
    )?;
    if affected == 0 {
        return Err(PhaseError::RunNotFound(id));
    }
    Ok(())
}

// Stamps `last_viewed_at` when the user selects/views an agent in the sidebar.
// Compared against `last_finished_at` to derive the unread indicator.
#[tauri::command]
pub fn agent_mark_viewed(
    state: State<'_, Db>,
    id: String,
    at: String,
) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let affected = conn.execute(
        "UPDATE agents SET last_viewed_at = ?2 WHERE id = ?1",
        rusqlite::params![id, at],
    )?;
    if affected == 0 {
        return Err(PhaseError::RunNotFound(id));
    }
    Ok(())
}

// Returns the set of workspace ids that contain at least one agent whose
// terminal turn hasn't been viewed yet. The sidebar uses this to pulse the
// workspace dot even for workspaces the user isn't currently on (their tasks
// are not loaded in memory there).
#[tauri::command]
pub fn workspaces_with_unread(state: State<'_, Db>) -> Result<Vec<String>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT DISTINCT t.workspace_id
         FROM agents a
         JOIN sessions t ON a.session_id = t.id
         WHERE a.last_finished_at IS NOT NULL
           AND a.status != 'skipped'
           AND (a.last_viewed_at IS NULL OR a.last_finished_at > a.last_viewed_at)
           AND t.archived_at IS NULL
           AND t.deleted_at IS NULL",
    )?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}
