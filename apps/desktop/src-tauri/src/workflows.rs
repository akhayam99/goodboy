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
    #[serde(rename = "expectedOutput")]
    pub expected_output: Option<String>,
    #[serde(rename = "providerOverride")]
    pub provider_override: Option<String>,
    #[serde(rename = "modelOverride")]
    pub model_override: Option<String>,
    pub effort: Option<String>,
    pub verbosity: Option<String>,
    #[serde(rename = "orchestratorReason")]
    pub orchestrator_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StepDefRow {
    pub id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<String>,
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
    #[serde(rename = "processText")]
    pub process_text: Option<String>,
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
    // How the workflow came to exist: 'library' (shipped), 'custom' (built by
    // hand) or 'orchestrated' (born from a dynamic run). None on rows written
    // before the column existed.
    pub origin: Option<String>,
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
    #[serde(rename = "expectedOutput")]
    pub expected_output: Option<String>,
    #[serde(rename = "providerOverride")]
    pub provider_override: Option<String>,
    #[serde(rename = "modelOverride")]
    pub model_override: Option<String>,
    pub effort: Option<String>,
    pub verbosity: Option<String>,
    #[serde(rename = "orchestratorReason")]
    pub orchestrator_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PhaseTemplateUpsertInput {
    pub id: Option<String>,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub goal: Option<String>,
    #[serde(rename = "processText")]
    pub process_text: Option<String>,
    pub steps: Vec<StepInput>,
    // Defaults to true when omitted so existing callers keep producing presets.
    #[serde(rename = "isPreset", default = "default_true")]
    pub is_preset: bool,
    pub origin: Option<String>,
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
    #[serde(rename = "providerSessionProviderId")]
    pub provider_session_provider_id: Option<String>,
    #[serde(rename = "lastFinishedAt")]
    pub last_finished_at: Option<String>,
    #[serde(rename = "lastViewedAt")]
    pub last_viewed_at: Option<String>,
    #[serde(rename = "doneAt")]
    pub done_at: Option<String>,
    pub kind: Option<String>,
    pub verbosity: Option<String>,
    pub effort: Option<String>,
    #[serde(rename = "modelOverride")]
    pub model_override: Option<String>,
    #[serde(rename = "providerOverride")]
    pub provider_override: Option<String>,
    #[serde(rename = "parentAgentId")]
    pub parent_agent_id: Option<String>,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "sourceThreadId")]
    pub source_thread_id: Option<String>,
    #[serde(rename = "sourceThreadIds")]
    pub source_thread_ids: Option<String>,
    #[serde(rename = "sourceCommentUrl")]
    pub source_comment_url: Option<String>,
    #[serde(rename = "sourceKind")]
    pub source_kind: Option<String>,
    #[serde(rename = "domainsJson")]
    pub domains_json: Option<String>,
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
    pub effort: Option<String>,
    #[serde(rename = "modelOverride")]
    pub model_override: Option<String>,
    #[serde(rename = "providerOverride")]
    pub provider_override: Option<String>,
    #[serde(rename = "parentAgentId")]
    pub parent_agent_id: Option<String>,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "sourceThreadId")]
    pub source_thread_id: Option<String>,
    #[serde(rename = "sourceThreadIds")]
    pub source_thread_ids: Option<String>,
    #[serde(rename = "sourceCommentUrl")]
    pub source_comment_url: Option<String>,
    #[serde(rename = "sourceKind")]
    pub source_kind: Option<String>,
    #[serde(rename = "domainsJson")]
    pub domains_json: Option<String>,
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
                expected_output, provider_override, model_override, effort, verbosity,
                orchestrator_reason
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
pub fn workflow_list(
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
    let template_ids: Vec<(
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

#[tauri::command]
pub fn workflow_get(state: State<'_, Db>, id: String) -> Result<Option<WorkflowRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, name, description, goal, process_text, created_at, updated_at,
                deleted_at, is_preset, origin
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
            row.get::<_, Option<String>>(5)?,
            row.get::<_, i64>(6)?,
            row.get::<_, i64>(7)?,
            row.get::<_, Option<i64>>(8)?,
            row.get::<_, i64>(9)?,
            row.get::<_, Option<String>>(10)?,
        ))
    })?;
    match rows.next() {
        Some(r) => {
            let (rid, ws, name, desc, goal, process, created, updated, deleted, is_preset, origin) =
                r.map_err(PhaseError::Db)?;
            let template = row_to_template(
                &conn,
                rid,
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
            Ok(Some(template))
        }
        None => Ok(None),
    }
}

fn live_name_taken(
    conn: &rusqlite::Connection,
    workspace_id: &str,
    name: &str,
    id: &str,
) -> Result<bool, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT 1 FROM workflows
         WHERE workspace_id = ?1 AND name = ?2 AND id <> ?3 AND deleted_at IS NULL
         LIMIT 1",
    )?;
    stmt.exists(rusqlite::params![workspace_id, name, id])
}

fn resolve_live_name(
    conn: &rusqlite::Connection,
    workspace_id: &str,
    requested: &str,
    id: &str,
) -> Result<String, rusqlite::Error> {
    if !live_name_taken(conn, workspace_id, requested, id)? {
        return Ok(requested.to_string());
    }
    let mut suffix = 2;
    loop {
        let candidate = format!("{requested} {suffix}");
        if !live_name_taken(conn, workspace_id, &candidate, id)? {
            return Ok(candidate);
        }
        suffix += 1;
    }
}

#[tauri::command]
pub fn workflow_upsert(
    state: State<'_, Db>,
    input: PhaseTemplateUpsertInput,
) -> Result<WorkflowRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let now_ms = crate::util::now_ms();
    let now = crate::util::ms_to_iso(now_ms);

    // Resolve id: use provided or look up by (workspace_id, name) or generate new.
    let id = if let Some(ref given_id) = input.id {
        given_id.clone()
    } else {
        let existing: Option<String> = {
            let mut stmt = conn.prepare(
                "SELECT id FROM workflows
                 WHERE workspace_id = ?1 AND name = ?2 AND deleted_at IS NULL
                 LIMIT 1",
            )?;
            let mut rows = stmt
                .query_map(rusqlite::params![input.workspace_id, input.name], |row| {
                    row.get(0)
                })?;
            match rows.next() {
                Some(r) => Some(r.map_err(PhaseError::Db)?),
                None => None,
            }
        };
        existing.unwrap_or_else(crate::util::uuid_v4)
    };

    let name = resolve_live_name(&conn, &input.workspace_id, &input.name, &id)?;

    let created_at_ms: i64 = {
        let mut stmt = conn.prepare("SELECT created_at FROM workflows WHERE id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| row.get(0))?;
        match rows.next() {
            Some(r) => r.map_err(PhaseError::Db)?,
            None => now_ms,
        }
    };

    conn.execute(
        "INSERT INTO workflows (id, workspace_id, name, description, goal, process_text, created_at, updated_at, is_preset, origin)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
           name         = excluded.name,
           description  = excluded.description,
           goal         = excluded.goal,
           process_text = excluded.process_text,
           updated_at   = excluded.updated_at,
           is_preset    = excluded.is_preset,
           origin       = COALESCE(workflows.origin, excluded.origin),
           deleted_at   = NULL",
        rusqlite::params![
            id,
            input.workspace_id,
            name,
            input.description,
            input.goal,
            input.process_text,
            created_at_ms,
            now_ms,
            input.is_preset as i32,
            input.origin.clone(),
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
                expected_output, provider_override, model_override, effort, verbosity,
                orchestrator_reason, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL)
             ON CONFLICT(id) DO UPDATE SET
               workflow_id      = excluded.workflow_id,
               library_step_id  = excluded.library_step_id,
               role             = excluded.role,
               ordinal          = excluded.ordinal,
               name             = excluded.name,
               prompt_prefix    = excluded.prompt_prefix,
               expected_output  = excluded.expected_output,
               provider_override = excluded.provider_override,
               model_override   = excluded.model_override,
               effort           = excluded.effort,
               verbosity        = excluded.verbosity,
               orchestrator_reason = excluded.orchestrator_reason,
               deleted_at       = NULL",
            rusqlite::params![
                def_id,
                id,
                def.library_step_id,
                def.role,
                def.ordinal,
                def.name,
                def.prompt_prefix,
                def.expected_output,
                def.provider_override,
                def.model_override,
                def.effort,
                def.verbosity,
                def.orchestrator_reason,
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
            expected_output: def.expected_output.clone(),
            provider_override: def.provider_override.clone(),
            model_override: def.model_override.clone(),
            effort: def.effort.clone(),
            verbosity: def.verbosity.clone(),
            orchestrator_reason: def.orchestrator_reason.clone(),
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
        "UPDATE steps SET deleted_at = ?2
         WHERE workflow_id = ?1 AND deleted_at IS NULL AND id NOT IN ({})",
        placeholders
    );
    let mut params: Vec<&dyn rusqlite::ToSql> = Vec::with_capacity(kept_ids.len() + 1);
    params.push(&id);
    params.push(&now_ms);
    for k in &kept_ids {
        params.push(k);
    }
    conn.execute(&sql, params.as_slice())?;

    Ok(WorkflowRow {
        id,
        workspace_id: input.workspace_id,
        name,
        description: input.description,
        goal: input.goal,
        process_text: input.process_text,
        steps,
        created_at: crate::util::ms_to_iso(created_at_ms),
        updated_at: now,
        deleted_at: None,
        is_preset: input.is_preset,
        origin: input.origin,
    })
}

#[tauri::command]
pub fn workflow_delete(state: State<'_, Db>, id: String) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;

    let exists: bool = {
        let mut stmt = conn.prepare("SELECT 1 FROM workflows WHERE id = ?1 LIMIT 1")?;
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
            "UPDATE workflows SET deleted_at = ?2 WHERE id = ?1",
            rusqlite::params![id, crate::util::now_ms()],
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
        "SELECT w.id, w.workspace_id, w.name, w.description, w.goal, w.process_text, w.created_at,
                w.updated_at, w.deleted_at, w.is_preset, w.origin
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
        Option<String>,
        i64,
        i64,
        Option<i64>,
        i64,
        Option<String>,
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
        created_at: crate::util::ms_to_iso(row.get(9)?),
        updated_at: crate::util::ms_to_iso(row.get(10)?),
    })
}

const STEP_DEF_COLS: &str = "id, workspace_id, role, name, prompt_prefix, provider_default, \
     model_default, effort_default, verbosity_default, created_at, updated_at";

#[tauri::command]
pub fn step_def_list(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Vec<StepDefRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let sql = format!(
        "SELECT {cols} FROM step_library
         WHERE deleted_at IS NULL
           AND (workspace_id = ?1 OR workspace_id IS NULL)
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
    let now_ms = crate::util::now_ms();
    let now = crate::util::ms_to_iso(now_ms);
    let id = input.id.clone().unwrap_or_else(crate::util::uuid_v4);
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
            created_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, NULL)
         ON CONFLICT(id) DO UPDATE SET
           workspace_id      = excluded.workspace_id,
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
            input.role,
            input.name,
            input.prompt_prefix,
            input.provider_default,
            input.model_default,
            input.effort_default,
            input.verbosity_default,
            created_at_ms,
            now_ms,
        ],
    )?;

    Ok(StepDefRow {
        id,
        workspace_id: input.workspace_id,
        role: input.role,
        name: input.name,
        prompt_prefix: input.prompt_prefix,
        provider_default: input.provider_default,
        model_default: input.model_default,
        effort_default: input.effort_default,
        verbosity_default: input.verbosity_default,
        created_at: crate::util::ms_to_iso(created_at_ms),
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
        "UPDATE step_library SET deleted_at = ?2 WHERE id = ?1",
        rusqlite::params![id, crate::util::now_ms()],
    )?;
    if affected == 0 {
        return Err(PhaseError::TemplateNotFound(id));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Commands — agent (= session row) lifecycle
// ---------------------------------------------------------------------------

const AGENT_SESSION_COLS: &str =
    "id, session_id, step_id, ordinal, name, status, \
     provider_run_id, output_summary, started_at, last_finished_at, \
     provider_session_id, provider_session_provider_id, last_finished_at, last_viewed_at, done_at, kind, verbosity, \
     effort, model_override, provider_override, \
     parent_agent_id, workflow_run_id, source_thread_id, source_thread_ids, source_comment_url, \
     source_kind, domains_json";

fn session_row_from_row(row: &rusqlite::Row<'_>) -> Result<SessionRow, rusqlite::Error> {
    Ok(SessionRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        step_id: row.get(2)?,
        ordinal: row.get(3)?,
        name: row.get(4)?,
        status: row.get(5)?,
        provider_run_id: row.get(6)?,
        output_summary: row.get(7)?,
        started_at: crate::util::optional_ms_to_iso(row.get(8)?),
        completed_at: crate::util::optional_ms_to_iso(row.get(9)?),
        provider_session_id: row.get(10)?,
        provider_session_provider_id: row.get(11)?,
        last_finished_at: crate::util::optional_ms_to_iso(row.get(12)?),
        last_viewed_at: crate::util::optional_ms_to_iso(row.get(13)?),
        done_at: crate::util::optional_ms_to_iso(row.get(14)?),
        kind: row.get(15)?,
        verbosity: row.get(16)?,
        effort: row.get(17)?,
        model_override: row.get(18)?,
        provider_override: row.get(19)?,
        parent_agent_id: row.get(20)?,
        workflow_run_id: row.get(21)?,
        source_thread_id: row.get(22)?,
        source_thread_ids: row.get(23)?,
        source_comment_url: row.get(24)?,
        source_kind: row.get(25)?,
        domains_json: row.get(26)?,
    })
}

#[tauri::command]
pub fn agent_list_for_session(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Vec<SessionRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let sql = format!(
        "SELECT {cols} FROM agents WHERE session_id = ?1 ORDER BY ordinal ASC",
        cols = AGENT_SESSION_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![session_id], session_row_from_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

const AGENT_INSERT_SQL: &str = "INSERT INTO agents
   (id, session_id, step_id, ordinal, name, status,
    provider_run_id, output_summary, started_at, last_finished_at, kind, verbosity,
    effort, model_override, provider_override,
    parent_agent_id, workflow_run_id, source_thread_id, source_thread_ids, source_comment_url, source_kind,
    domains_json)
 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)";

#[tauri::command]
pub fn agent_insert(
    state: State<'_, Db>,
    input: PhaseRunInsertInput,
) -> Result<SessionRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let id = input.id.clone().unwrap_or_else(crate::util::uuid_v4);
    let started_at_ms = input.started_at.as_deref().and_then(crate::util::iso_to_ms);
    let completed_at_ms = input
        .completed_at
        .as_deref()
        .and_then(crate::util::iso_to_ms);

    conn.execute(
        AGENT_INSERT_SQL,
        rusqlite::params![
            id,
            input.session_id,
            input.step_id,
            input.ordinal,
            input.name,
            input.status,
            input.provider_run_id,
            input.output_summary,
            started_at_ms,
            completed_at_ms,
            input.kind,
            input.verbosity,
            input.effort,
            input.model_override,
            input.provider_override,
            input.parent_agent_id,
            input.workflow_run_id,
            input.source_thread_id,
            input.source_thread_ids,
            input.source_comment_url,
            input.source_kind,
            input.domains_json,
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
        completed_at: input.completed_at.clone(),
        provider_session_id: None,
        provider_session_provider_id: None,
        last_finished_at: input.completed_at,
        last_viewed_at: None,
        done_at: None,
        kind: input.kind,
        verbosity: input.verbosity,
        effort: input.effort,
        model_override: input.model_override,
        provider_override: input.provider_override,
        parent_agent_id: input.parent_agent_id,
        workflow_run_id: input.workflow_run_id,
        source_thread_id: input.source_thread_id,
        source_thread_ids: input.source_thread_ids,
        source_comment_url: input.source_comment_url,
        source_kind: input.source_kind,
        domains_json: input.domains_json,
    })
}

#[tauri::command]
pub fn agent_update_status(
    state: State<'_, Db>,
    input: PhaseRunUpdateInput,
) -> Result<SessionRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let started_at_ms = input.started_at.as_deref().and_then(crate::util::iso_to_ms);
    let completed_at_ms = input
        .completed_at
        .as_deref()
        .and_then(crate::util::iso_to_ms);

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
           last_finished_at = CASE WHEN ?7 = 1
             THEN COALESCE(?6, last_finished_at, ?8)
             ELSE last_finished_at END
         WHERE id = ?1",
        rusqlite::params![
            input.id,
            input.status,
            input.provider_run_id,
            input.output_summary,
            started_at_ms,
            completed_at_ms,
            is_terminal as i32,
            crate::util::now_ms(),
        ],
    )?;

    let sql = format!(
        "SELECT {cols} FROM agents WHERE id = ?1 LIMIT 1",
        cols = AGENT_SESSION_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query_map(rusqlite::params![input.id], session_row_from_row)?;
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

#[tauri::command]
pub fn agent_set_provider_session_id(
    state: State<'_, Db>,
    id: String,
    provider_session_id: String,
    provider_session_provider_id: String,
) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let affected = conn.execute(
        "UPDATE agents SET provider_session_id = ?2, provider_session_provider_id = ?3 WHERE id = ?1",
        rusqlite::params![id, provider_session_id, provider_session_provider_id],
    )?;
    if affected == 0 {
        return Err(PhaseError::RunNotFound(id));
    }
    Ok(())
}

// Stamps `last_viewed_at` when the user selects/views an agent in the sidebar.
// Compared against `last_finished_at` to derive the unread indicator.
#[tauri::command]
pub fn agent_mark_viewed(state: State<'_, Db>, id: String, at: String) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let affected = conn.execute(
        "UPDATE agents SET last_viewed_at = ?2 WHERE id = ?1",
        rusqlite::params![
            id,
            crate::util::iso_to_ms(&at).unwrap_or_else(crate::util::now_ms)
        ],
    )?;
    if affected == 0 {
        return Err(PhaseError::RunNotFound(id));
    }
    Ok(())
}

#[tauri::command]
pub fn agent_set_done(
    state: State<'_, Db>,
    id: String,
    done: bool,
    at: Option<String>,
) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let affected = conn.execute(
        "UPDATE agents SET done_at = CASE WHEN ?2 = 1 THEN ?3 ELSE NULL END WHERE id = ?1",
        rusqlite::params![
            id,
            done as i32,
            at.as_deref().and_then(crate::util::iso_to_ms)
        ],
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

    fn agents_table_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE agents (
                id TEXT, session_id TEXT, step_id TEXT, ordinal INTEGER, name TEXT, status TEXT,
                provider_run_id TEXT, output_summary TEXT, started_at TEXT,
                provider_session_id TEXT, provider_session_provider_id TEXT, last_finished_at TEXT, last_viewed_at TEXT, done_at TEXT,
                kind TEXT, verbosity TEXT, effort TEXT, model_override TEXT, provider_override TEXT,
                parent_agent_id TEXT, workflow_run_id TEXT, source_thread_id TEXT,
                source_thread_ids TEXT, source_comment_url TEXT, source_kind TEXT, domains_json TEXT
            )",
        )
        .unwrap();
        conn
    }

    fn workflows_table_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE workflows (
                id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, description TEXT,
                created_at TEXT, updated_at TEXT, deleted_at INTEGER, is_preset INTEGER,
                origin TEXT,
                goal TEXT, process_text TEXT
            );
            CREATE UNIQUE INDEX idx_workflows_workspace_name_live
              ON workflows(workspace_id, name) WHERE deleted_at IS NULL;",
        )
        .unwrap();
        conn
    }

    fn insert_workflow(conn: &rusqlite::Connection, id: &str, name: &str, deleted: Option<i64>) {
        conn.execute(
            "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, deleted_at, is_preset)
             VALUES (?1, 'ws1', ?2, '', '2026-01-01', '2026-01-01', ?3, 0)",
            rusqlite::params![id, name, deleted],
        )
        .unwrap();
    }

    #[test]
    fn resolve_live_name_keeps_a_free_name() {
        let conn = workflows_table_conn();
        insert_workflow(&conn, "w1", "Orchestrated workflow", Some(1));
        let name = resolve_live_name(&conn, "ws1", "Orchestrated workflow", "w2").unwrap();
        assert_eq!(name, "Orchestrated workflow");
    }

    #[test]
    fn resolve_live_name_suffixes_against_live_rows() {
        let conn = workflows_table_conn();
        insert_workflow(&conn, "w1", "Orchestrated workflow", None);
        insert_workflow(&conn, "w2", "Orchestrated workflow 2", None);
        let name = resolve_live_name(&conn, "ws1", "Orchestrated workflow", "w3").unwrap();
        assert_eq!(name, "Orchestrated workflow 3");
    }

    #[test]
    fn resolve_live_name_ignores_the_row_being_updated() {
        let conn = workflows_table_conn();
        insert_workflow(&conn, "w1", "Ship It", None);
        let name = resolve_live_name(&conn, "ws1", "Ship It", "w1").unwrap();
        assert_eq!(name, "Ship It");
    }

    #[test]
    fn agent_session_cols_round_trips_routing_fields() {
        let conn = agents_table_conn();
        conn.execute(
            "INSERT INTO agents (id, session_id, ordinal, name, status, provider_session_id, provider_session_provider_id, effort, model_override, provider_override)
             VALUES ('a1', 's1', 0, 'scout', 'pending', 'session-1', 'anthropic', 'high', 'claude-opus-4-8', 'anthropic')",
            [],
        )
        .unwrap();

        let sql = format!(
            "SELECT {cols} FROM agents WHERE id = ?1",
            cols = AGENT_SESSION_COLS
        );
        let mut stmt = conn.prepare(&sql).unwrap();
        let row = stmt
            .query_row(rusqlite::params!["a1"], session_row_from_row)
            .unwrap();

        assert_eq!(row.provider_session_id.as_deref(), Some("session-1"));
        assert_eq!(
            row.provider_session_provider_id.as_deref(),
            Some("anthropic")
        );
        assert_eq!(row.effort.as_deref(), Some("high"));
        assert_eq!(row.model_override.as_deref(), Some("claude-opus-4-8"));
        assert_eq!(row.provider_override.as_deref(), Some("anthropic"));
        let serialized = serde_json::to_value(row).unwrap();
        assert_eq!(serialized["providerSessionProviderId"], "anthropic");
    }

    #[test]
    fn agent_session_cols_default_routing_fields_to_none() {
        let conn = agents_table_conn();
        conn.execute(
            "INSERT INTO agents (id, session_id, ordinal, name, status)
             VALUES ('a2', 's1', 1, 'planner', 'pending')",
            [],
        )
        .unwrap();

        let sql = format!(
            "SELECT {cols} FROM agents WHERE id = ?1",
            cols = AGENT_SESSION_COLS
        );
        let mut stmt = conn.prepare(&sql).unwrap();
        let row = stmt
            .query_row(rusqlite::params!["a2"], session_row_from_row)
            .unwrap();

        assert!(row.effort.is_none());
        assert!(row.model_override.is_none());
        assert!(row.provider_override.is_none());
        assert!(row.provider_session_provider_id.is_none());
    }

    #[test]
    fn agent_insert_sql_writes_the_routing_columns() {
        let conn = agents_table_conn();
        conn.execute(
            AGENT_INSERT_SQL,
            rusqlite::params![
                "a3",
                "s1",
                "step-1",
                0,
                "implement",
                "pending",
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                "implementer",
                None::<String>,
                "high",
                "gpt-5.6",
                "codex",
                None::<String>,
                "run-1",
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
                None::<String>,
            ],
        )
        .unwrap();

        let sql = format!(
            "SELECT {cols} FROM agents WHERE id = ?1",
            cols = AGENT_SESSION_COLS
        );
        let mut stmt = conn.prepare(&sql).unwrap();
        let row = stmt
            .query_row(rusqlite::params!["a3"], session_row_from_row)
            .unwrap();

        assert_eq!(row.effort.as_deref(), Some("high"));
        assert_eq!(row.model_override.as_deref(), Some("gpt-5.6"));
        assert_eq!(row.provider_override.as_deref(), Some("codex"));
    }
}
