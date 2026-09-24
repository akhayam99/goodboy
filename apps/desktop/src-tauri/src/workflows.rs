use rusqlite::OptionalExtension;
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
    #[serde(rename = "routingLock")]
    pub routing_lock: Option<String>,
    #[serde(rename = "routingDecision")]
    pub routing_decision: Option<String>,
    #[serde(rename = "taskProfile")]
    pub task_profile: Option<String>,
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
    #[serde(rename = "routingLock")]
    pub routing_lock: Option<String>,
    #[serde(rename = "routingDecision")]
    pub routing_decision: Option<String>,
    #[serde(rename = "taskProfile")]
    pub task_profile: Option<String>,
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
    #[serde(rename = "executionPurpose")]
    pub execution_purpose: Option<String>,
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
    #[serde(rename = "routingLock")]
    pub routing_lock: Option<String>,
    #[serde(rename = "routingDecision")]
    pub routing_decision: Option<String>,
    #[serde(rename = "taskProfile")]
    pub task_profile: Option<String>,
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
    #[serde(rename = "executionPurpose", default)]
    pub execution_purpose: Option<String>,
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
    #[serde(rename = "routingLock")]
    pub routing_lock: Option<String>,
    #[serde(rename = "routingDecision")]
    pub routing_decision: Option<String>,
    #[serde(rename = "taskProfile")]
    pub task_profile: Option<String>,
    #[serde(rename = "generationReservationId", default)]
    pub generation_reservation_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AgentBatchInsertInput {
    #[serde(rename = "parentAgentId")]
    pub parent_agent_id: String,
    pub children: Vec<PhaseRunInsertInput>,
}

#[derive(Debug, Serialize)]
pub struct AgentBatchInsertOutcome {
    pub inserted: bool,
    pub agents: Vec<SessionRow>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClusterCompletionHoldRow {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "containerAgentId")]
    pub container_agent_id: String,
    #[serde(rename = "sourceAgentId")]
    pub source_agent_id: String,
    #[serde(rename = "sourceTurnId")]
    pub source_turn_id: String,
    pub reason: String,
    #[serde(rename = "findingsJson")]
    pub findings_json: String,
    pub state: String,
    #[serde(rename = "resolutionEvidence")]
    pub resolution_evidence: Option<String>,
    #[serde(rename = "resolvedAt")]
    pub resolved_at: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ClusterCompletionHoldInput {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "containerAgentId")]
    pub container_agent_id: String,
    #[serde(rename = "sourceAgentId")]
    pub source_agent_id: String,
    #[serde(rename = "sourceTurnId")]
    pub source_turn_id: String,
    pub reason: String,
    #[serde(rename = "findingsJson")]
    pub findings_json: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CapabilityRequestRow {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "obligationId")]
    pub obligation_id: String,
    #[serde(rename = "requesterAgentId")]
    pub requester_agent_id: String,
    #[serde(rename = "sourceTurnId")]
    pub source_turn_id: String,
    #[serde(rename = "targetRole")]
    pub target_role: String,
    pub purpose: String,
    pub question: String,
    #[serde(rename = "scopeJson")]
    pub scope_json: String,
    #[serde(rename = "evidenceJson")]
    pub evidence_json: String,
    pub gap: String,
    #[serde(rename = "expectedOutput")]
    pub expected_output: String,
    pub continuation: String,
    #[serde(rename = "routingProposal")]
    pub routing_proposal: Option<String>,
    #[serde(rename = "inventoryRevision")]
    pub inventory_revision: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CapabilityObligationRow {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    pub identity: String,
    #[serde(rename = "requesterAgentId")]
    pub requester_agent_id: String,
    #[serde(rename = "targetRole")]
    pub target_role: String,
    pub purpose: String,
    pub state: String,
    #[serde(rename = "ownerAgentId")]
    pub owner_agent_id: Option<String>,
    pub decision: Option<String>,
    #[serde(rename = "childAgentId")]
    pub child_agent_id: Option<String>,
    #[serde(rename = "deliveredAt")]
    pub delivered_at: Option<String>,
    #[serde(rename = "deliveryReceipt")]
    pub delivery_receipt: Option<String>,
    pub requests: Vec<CapabilityRequestRow>,
    #[serde(rename = "holdIds")]
    pub hold_ids: Vec<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CapabilityNeedInput {
    #[serde(rename = "requestId")]
    pub request_id: String,
    #[serde(rename = "obligationId")]
    pub obligation_id: String,
    pub identity: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "requesterAgentId")]
    pub requester_agent_id: String,
    #[serde(rename = "sourceTurnId")]
    pub source_turn_id: String,
    #[serde(rename = "targetRole")]
    pub target_role: String,
    pub purpose: String,
    pub question: String,
    #[serde(rename = "scopeJson")]
    pub scope_json: String,
    #[serde(rename = "evidenceJson")]
    pub evidence_json: String,
    pub gap: String,
    #[serde(rename = "expectedOutput")]
    pub expected_output: String,
    pub continuation: String,
    #[serde(rename = "routingProposal")]
    pub routing_proposal: Option<String>,
    #[serde(rename = "inventoryRevision")]
    pub inventory_revision: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EvidenceInventoryRow {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub revision: String,
    #[serde(rename = "entriesJson")]
    pub entries_json: String,
    #[serde(rename = "omittedCount")]
    pub omitted_count: i64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct EvidenceInventoryInput {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub revision: String,
    #[serde(rename = "entriesJson")]
    pub entries_json: String,
    #[serde(rename = "omittedCount")]
    pub omitted_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EvidenceDeliveryReceiptRow {
    pub id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "sourceTurnId")]
    pub source_turn_id: String,
    #[serde(rename = "inventoryRevision")]
    pub inventory_revision: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "requestedRange")]
    pub requested_range: Option<String>,
    pub outcome: String,
    #[serde(rename = "deliveredChars")]
    pub delivered_chars: i64,
    pub reason: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct EvidenceDeliveryEntry {
    #[serde(rename = "sourceId")]
    pub source_id: String,
    #[serde(rename = "requestedRange")]
    pub requested_range: Option<String>,
    pub outcome: String,
    #[serde(rename = "deliveredChars")]
    pub delivered_chars: i64,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct EvidenceDeliveryInput {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "sourceTurnId")]
    pub source_turn_id: String,
    #[serde(rename = "inventoryRevision")]
    pub inventory_revision: String,
    pub receipts: Vec<EvidenceDeliveryEntry>,
}

#[derive(Debug, Deserialize)]
pub struct GenerationReservationInput {
    #[serde(rename = "reservationId")]
    pub reservation_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "parentAgentId")]
    pub parent_agent_id: Option<String>,
    #[serde(rename = "creationPath")]
    pub creation_path: String,
    pub count: i64,
    #[serde(rename = "obligationId")]
    pub obligation_id: Option<String>,
    pub purpose: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerationReservationRow {
    #[serde(rename = "reservationId")]
    pub reservation_id: String,
    pub depth: i64,
    #[serde(rename = "causalRootAgentId")]
    pub causal_root_agent_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerationReservationOutcome {
    pub kind: String,
    pub reservations: Vec<GenerationReservationRow>,
    pub limit: Option<String>,
    pub reason: Option<String>,
    #[serde(rename = "isFirstRefusal")]
    pub is_first_refusal: bool,
}

#[derive(Debug, Deserialize)]
pub struct ClusterCompletionHoldResolutionInput {
    pub id: String,
    #[serde(rename = "resolutionEvidence")]
    pub resolution_evidence: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterExecutionNodeRow {
    #[serde(rename = "nodeId")]
    pub node_id: String,
    #[serde(rename = "agentId")]
    pub agent_id: Option<String>,
    pub ordinal: i64,
    pub role: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClusterExecutionGraphRow {
    #[serde(rename = "containerAgentId")]
    pub container_agent_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "planId")]
    pub plan_id: Option<String>,
    #[serde(rename = "goalTitle")]
    pub goal_title: String,
    #[serde(rename = "executionVersion")]
    pub execution_version: i64,
    #[serde(rename = "graphJson")]
    pub graph_json: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub nodes: Vec<ClusterExecutionNodeRow>,
}

#[derive(Debug, Deserialize)]
pub struct ClusterExecutionGraphInput {
    #[serde(rename = "containerAgentId")]
    pub container_agent_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "workflowRunId")]
    pub workflow_run_id: Option<String>,
    #[serde(rename = "planId")]
    pub plan_id: Option<String>,
    #[serde(rename = "goalTitle")]
    pub goal_title: String,
    #[serde(rename = "executionVersion")]
    pub execution_version: i64,
    #[serde(rename = "graphJson")]
    pub graph_json: String,
    pub nodes: Vec<ClusterExecutionNodeRow>,
}

#[derive(Debug, Deserialize)]
pub struct WorkflowNodeRoutingUpdateInput {
    #[serde(rename = "nodeKind")]
    pub node_kind: String,
    pub id: String,
    #[serde(rename = "routingLock")]
    pub routing_lock: Option<String>,
    #[serde(rename = "routingDecision")]
    pub routing_decision: String,
    #[serde(rename = "taskProfile")]
    pub task_profile: Option<String>,
    #[serde(rename = "providerOverride")]
    pub provider_override: Option<String>,
    #[serde(rename = "modelOverride")]
    pub model_override: Option<String>,
    pub effort: Option<String>,
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
    #[error("invalid workflow routing value")]
    InvalidRouting,
    #[error("workflow node cannot be changed: {0}")]
    NodeNotMutable(String),
    #[error("cluster completion hold resolution requires evidence")]
    InvalidHoldResolution,
    #[error("generation reservation cannot be bound: {0}")]
    ReservationNotBindable(String),
}

crate::util::impl_error_serialize!(PhaseError);

impl PhaseError {
    fn kind(&self) -> &'static str {
        match self {
            PhaseError::Db(_) => "db",
            PhaseError::Poisoned => "poisoned",
            PhaseError::TemplateNotFound(_) => "template_not_found",
            PhaseError::RunNotFound(_) => "run_not_found",
            PhaseError::InvalidRouting => "invalid_routing",
            PhaseError::NodeNotMutable(_) => "node_not_mutable",
            PhaseError::InvalidHoldResolution => "invalid_hold_resolution",
            PhaseError::ReservationNotBindable(_) => "reservation_not_bindable",
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

fn string_in(value: Option<&serde_json::Value>, allowed: &[&str]) -> bool {
    value
        .and_then(serde_json::Value::as_str)
        .is_some_and(|candidate| allowed.contains(&candidate))
}

fn has_exact_keys(value: &serde_json::Map<String, serde_json::Value>, keys: &[&str]) -> bool {
    value.len() == keys.len() && keys.iter().all(|key| value.contains_key(*key))
}

fn valid_reason(value: Option<&serde_json::Value>) -> bool {
    value
        .and_then(serde_json::Value::as_str)
        .is_some_and(|reason| reason.chars().count() <= 240)
}

fn valid_pick(value: &serde_json::Value) -> bool {
    let Some(pick) = value.as_object() else {
        return false;
    };
    if !has_exact_keys(pick, &["provider", "model", "effort"]) {
        return false;
    }
    let is_provider = string_in(
        pick.get("provider"),
        &[
            "anthropic",
            "cursor",
            "codex",
            "gemini",
            "opencode",
            "openrouter",
            "moonshot",
        ],
    );
    let is_model = pick
        .get("model")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|model| !model.is_empty());
    let is_effort = pick.get("effort").is_some_and(|effort| {
        effort.is_null()
            || string_in(
                Some(effort),
                &["minimal", "low", "medium", "high", "xhigh", "max"],
            )
    });
    is_provider && is_model && is_effort
}

fn valid_task_profile(value: &serde_json::Value) -> bool {
    let Some(profile) = value.as_object() else {
        return false;
    };
    has_exact_keys(profile, &["taskType", "difficulty", "basis"])
        && string_in(
            profile.get("taskType"),
            &[
                "exploration",
                "planning",
                "implementation",
                "debugging",
                "review",
                "testing",
                "writing",
                "general",
            ],
        )
        && string_in(
            profile.get("difficulty"),
            &["light", "standard", "heavy", "unknown"],
        )
        && string_in(profile.get("basis"), &["agent", "heuristic", "unknown"])
}

fn valid_routing_lock(value: &serde_json::Value) -> bool {
    let Some(lock) = value.as_object() else {
        return false;
    };
    has_exact_keys(lock, &["version", "pick", "origin"])
        && lock.get("version").and_then(serde_json::Value::as_u64) == Some(1)
        && lock.get("pick").is_some_and(valid_pick)
        && string_in(lock.get("origin"), &["user", "legacy"])
}

fn valid_proposal(value: &serde_json::Value) -> bool {
    let Some(proposal) = value.as_object() else {
        return false;
    };
    has_exact_keys(proposal, &["pick", "reason", "source", "profile"])
        && proposal.get("pick").is_some_and(valid_pick)
        && valid_reason(proposal.get("reason"))
        && string_in(proposal.get("source"), &["agent", "heuristic"])
        && proposal.get("profile").is_some_and(valid_task_profile)
}

fn valid_routing_decision(value: &serde_json::Value) -> bool {
    let Some(decision) = value.as_object() else {
        return false;
    };
    if !has_exact_keys(
        decision,
        &[
            "version",
            "proposal",
            "selected",
            "source",
            "reason",
            "adjustment",
            "executed",
        ],
    ) {
        return false;
    }
    let is_proposal = decision
        .get("proposal")
        .is_some_and(|proposal| proposal.is_null() || valid_proposal(proposal));
    let is_executed = decision
        .get("executed")
        .is_some_and(|executed| executed.is_null() || valid_pick(executed));
    decision.get("version").and_then(serde_json::Value::as_u64) == Some(1)
        && is_proposal
        && decision.get("selected").is_some_and(valid_pick)
        && string_in(
            decision.get("source"),
            &[
                "step_lock",
                "run_role_lock",
                "agent",
                "heuristic",
                "role_default",
                "session_default",
                "kind_default",
                "legacy",
            ],
        )
        && valid_reason(decision.get("reason"))
        && string_in(
            decision.get("adjustment"),
            &[
                "none",
                "unknown_model",
                "disconnected",
                "cooldown",
                "budget",
                "unsupported_effort",
            ],
        )
        && is_executed
}

fn valid_optional_json(value: Option<&String>, validator: fn(&serde_json::Value) -> bool) -> bool {
    let Some(encoded) = value else {
        return true;
    };
    serde_json::from_str::<serde_json::Value>(encoded)
        .ok()
        .is_some_and(|parsed| validator(&parsed))
}

fn validate_routing_values(
    routing_lock: Option<&String>,
    routing_decision: Option<&String>,
    task_profile: Option<&String>,
) -> Result<(), PhaseError> {
    if !valid_optional_json(routing_lock, valid_routing_lock)
        || !valid_optional_json(routing_decision, valid_routing_decision)
        || !valid_optional_json(task_profile, valid_task_profile)
    {
        return Err(PhaseError::InvalidRouting);
    }
    Ok(())
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
                orchestrator_reason, routing_lock, routing_decision, task_profile
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

fn live_name_taken(
    conn: &rusqlite::Connection,
    workspace_id: &str,
    name: &str,
    id: &str,
) -> Result<bool, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT 1 FROM workflows
         WHERE workspace_id = ?1 AND name = ?2 AND id <> ?3 AND deleted_at IS NULL
           AND is_preset = 1
         LIMIT 1",
    )?;
    stmt.exists(rusqlite::params![workspace_id, name, id])
}

fn resolve_live_name(
    conn: &rusqlite::Connection,
    workspace_id: &str,
    requested: &str,
    id: &str,
    is_preset: bool,
) -> Result<String, rusqlite::Error> {
    if !is_preset {
        return Ok(requested.to_string());
    }
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
pub async fn workflow_upsert(
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
                   AND is_preset = 1
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

    let name = resolve_live_name(
        &conn,
        &input.workspace_id,
        &input.name,
        &id,
        input.is_preset,
    )?;

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
        validate_routing_values(
            def.routing_lock.as_ref(),
            def.routing_decision.as_ref(),
            def.task_profile.as_ref(),
        )?;
        let def_id = def.id.clone().unwrap_or_else(crate::util::uuid_v4);
        conn.execute(
            "INSERT INTO steps
               (id, workflow_id, library_step_id, role, ordinal, name, prompt_prefix,
                expected_output, provider_override, model_override, effort, verbosity,
                orchestrator_reason, routing_lock, routing_decision, task_profile, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, NULL)
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
               routing_lock     = excluded.routing_lock,
               routing_decision = excluded.routing_decision,
               task_profile     = excluded.task_profile,
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
                def.routing_lock,
                def.routing_decision,
                def.task_profile,
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
            routing_lock: def.routing_lock.clone(),
            routing_decision: def.routing_decision.clone(),
            task_profile: def.task_profile.clone(),
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
pub async fn workflow_delete(state: State<'_, Db>, id: String) -> Result<(), PhaseError> {
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
pub async fn step_def_list(
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
pub async fn step_def_upsert(
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
pub async fn step_def_delete(state: State<'_, Db>, id: String) -> Result<(), PhaseError> {
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
     source_kind, domains_json, routing_lock, routing_decision, task_profile, execution_purpose";

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
        routing_lock: row.get(27)?,
        routing_decision: row.get(28)?,
        task_profile: row.get(29)?,
        execution_purpose: row.get(30)?,
    })
}

#[tauri::command]
pub async fn agent_list_for_session(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Vec<SessionRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let sql = format!(
        "SELECT {cols} FROM live_agents WHERE session_id = ?1 ORDER BY ordinal ASC",
        cols = AGENT_SESSION_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![session_id], session_row_from_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

fn cluster_completion_hold_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ClusterCompletionHoldRow> {
    Ok(ClusterCompletionHoldRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        workflow_run_id: row.get(2)?,
        container_agent_id: row.get(3)?,
        source_agent_id: row.get(4)?,
        source_turn_id: row.get(5)?,
        reason: row.get(6)?,
        findings_json: row.get(7)?,
        state: row.get(8)?,
        resolution_evidence: row.get(9)?,
        resolved_at: crate::util::optional_ms_to_iso(row.get(10)?),
        created_at: crate::util::ms_to_iso(row.get(11)?),
        updated_at: crate::util::ms_to_iso(row.get(12)?),
    })
}

const CLUSTER_COMPLETION_HOLD_COLUMNS: &str =
    "id, session_id, workflow_run_id, container_agent_id, source_agent_id, source_turn_id, reason, findings_json, state, resolution_evidence, resolved_at, created_at, updated_at";

fn list_cluster_completion_holds(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<Vec<ClusterCompletionHoldRow>, PhaseError> {
    let sql = format!(
        "SELECT {CLUSTER_COMPLETION_HOLD_COLUMNS} FROM cluster_completion_holds WHERE session_id = ?1 ORDER BY created_at ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params![session_id],
        cluster_completion_hold_from_row,
    )?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

#[tauri::command]
pub async fn cluster_completion_holds_for_session(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Vec<ClusterCompletionHoldRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    list_cluster_completion_holds(&conn, &session_id)
}

fn record_cluster_completion_hold(
    conn: &rusqlite::Connection,
    input: ClusterCompletionHoldInput,
) -> Result<ClusterCompletionHoldRow, PhaseError> {
    let now = crate::util::now_ms();
    conn.execute(
        "INSERT OR IGNORE INTO cluster_completion_holds
           (id, session_id, workflow_run_id, container_agent_id, source_agent_id, source_turn_id,
            reason, findings_json, state, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'open', ?9, ?9)",
        rusqlite::params![
            input.id,
            input.session_id,
            input.workflow_run_id,
            input.container_agent_id,
            input.source_agent_id,
            input.source_turn_id,
            input.reason,
            input.findings_json,
            now,
        ],
    )?;
    let sql = format!(
        "SELECT {CLUSTER_COMPLETION_HOLD_COLUMNS} FROM cluster_completion_holds WHERE source_agent_id = ?1 AND source_turn_id = ?2"
    );
    let hold = conn
        .query_row(
            &sql,
            rusqlite::params![input.source_agent_id, input.source_turn_id],
            cluster_completion_hold_from_row,
        )
        .map_err(PhaseError::Db)?;
    associate_hold_obligations(conn, &hold)?;
    Ok(hold)
}

#[tauri::command]
pub async fn cluster_completion_hold_record(
    state: State<'_, Db>,
    input: ClusterCompletionHoldInput,
) -> Result<ClusterCompletionHoldRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    record_cluster_completion_hold(&conn, input)
}

const CAPABILITY_REQUEST_COLUMNS: &str =
    "id, session_id, workflow_run_id, obligation_id, requester_agent_id, source_turn_id, target_role, purpose, question, scope_json, evidence_json, gap, expected_output, continuation, routing_proposal, inventory_revision, created_at";

const CAPABILITY_OBLIGATION_COLUMNS: &str =
    "id, session_id, workflow_run_id, identity, requester_agent_id, target_role, purpose, state, owner_agent_id, decision, child_agent_id, delivered_at, delivery_receipt, created_at, updated_at";

fn capability_request_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CapabilityRequestRow> {
    Ok(CapabilityRequestRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        workflow_run_id: row.get(2)?,
        obligation_id: row.get(3)?,
        requester_agent_id: row.get(4)?,
        source_turn_id: row.get(5)?,
        target_role: row.get(6)?,
        purpose: row.get(7)?,
        question: row.get(8)?,
        scope_json: row.get(9)?,
        evidence_json: row.get(10)?,
        gap: row.get(11)?,
        expected_output: row.get(12)?,
        continuation: row.get(13)?,
        routing_proposal: row.get(14)?,
        inventory_revision: row.get(15)?,
        created_at: crate::util::ms_to_iso(row.get(16)?),
    })
}

fn capability_obligation_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<CapabilityObligationRow> {
    Ok(CapabilityObligationRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        workflow_run_id: row.get(2)?,
        identity: row.get(3)?,
        requester_agent_id: row.get(4)?,
        target_role: row.get(5)?,
        purpose: row.get(6)?,
        state: row.get(7)?,
        owner_agent_id: row.get(8)?,
        decision: row.get(9)?,
        child_agent_id: row.get(10)?,
        delivered_at: crate::util::optional_ms_to_iso(row.get(11)?),
        delivery_receipt: row.get(12)?,
        requests: Vec::new(),
        hold_ids: Vec::new(),
        created_at: crate::util::ms_to_iso(row.get(13)?),
        updated_at: crate::util::ms_to_iso(row.get(14)?),
    })
}

fn capability_requests_for_obligation(
    conn: &rusqlite::Connection,
    obligation_id: &str,
) -> Result<Vec<CapabilityRequestRow>, PhaseError> {
    let sql = format!(
        "SELECT {CAPABILITY_REQUEST_COLUMNS} FROM capability_requests WHERE obligation_id = ?1 ORDER BY created_at ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![obligation_id], capability_request_from_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

fn capability_hold_ids_for_obligation(
    conn: &rusqlite::Connection,
    obligation_id: &str,
) -> Result<Vec<String>, PhaseError> {
    let mut stmt = conn.prepare(
        "SELECT hold_id FROM capability_obligation_holds WHERE obligation_id = ?1 ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![obligation_id], |row| row.get::<_, String>(0))?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

fn hydrate_capability_obligation(
    conn: &rusqlite::Connection,
    obligation: &mut CapabilityObligationRow,
) -> Result<(), PhaseError> {
    obligation.requests = capability_requests_for_obligation(conn, &obligation.id)?;
    obligation.hold_ids = capability_hold_ids_for_obligation(conn, &obligation.id)?;
    Ok(())
}

fn list_capability_obligations(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<Vec<CapabilityObligationRow>, PhaseError> {
    let sql = format!(
        "SELECT {CAPABILITY_OBLIGATION_COLUMNS} FROM capability_obligations WHERE session_id = ?1 ORDER BY created_at ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![session_id], capability_obligation_from_row)?;
    let mut obligations = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(PhaseError::Db)?;
    for obligation in obligations.iter_mut() {
        hydrate_capability_obligation(conn, obligation)?;
    }
    Ok(obligations)
}

#[tauri::command]
pub async fn capability_obligations_for_session(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Vec<CapabilityObligationRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    list_capability_obligations(&conn, &session_id)
}

struct CapabilityObligationSeed<'a> {
    id: &'a str,
    session_id: &'a str,
    workflow_run_id: Option<&'a str>,
    identity: &'a str,
    requester_agent_id: &'a str,
    target_role: &'a str,
    purpose: &'a str,
}

fn insert_capability_obligation(
    conn: &rusqlite::Connection,
    seed: CapabilityObligationSeed<'_>,
) -> Result<CapabilityObligationRow, PhaseError> {
    let now = crate::util::now_ms();
    conn.execute(
        "INSERT OR IGNORE INTO capability_obligations
           (id, session_id, workflow_run_id, identity, requester_agent_id, target_role, purpose,
            state, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'open', ?8, ?8)",
        rusqlite::params![
            seed.id,
            seed.session_id,
            seed.workflow_run_id,
            seed.identity,
            seed.requester_agent_id,
            seed.target_role,
            seed.purpose,
            now,
        ],
    )?;
    let sql = format!(
        "SELECT {CAPABILITY_OBLIGATION_COLUMNS} FROM capability_obligations WHERE identity = ?1"
    );
    conn.query_row(
        &sql,
        rusqlite::params![seed.identity],
        capability_obligation_from_row,
    )
    .map_err(PhaseError::Db)
}

fn record_capability_need(
    conn: &rusqlite::Connection,
    input: CapabilityNeedInput,
) -> Result<CapabilityObligationRow, PhaseError> {
    let mut obligation = insert_capability_obligation(
        conn,
        CapabilityObligationSeed {
            id: &input.obligation_id,
            session_id: &input.session_id,
            workflow_run_id: input.workflow_run_id.as_deref(),
            identity: &input.identity,
            requester_agent_id: &input.requester_agent_id,
            target_role: &input.target_role,
            purpose: &input.purpose,
        },
    )?;
    let now = crate::util::now_ms();
    conn.execute(
        "INSERT OR IGNORE INTO capability_requests
           (id, session_id, workflow_run_id, obligation_id, requester_agent_id, source_turn_id,
            target_role, purpose, question, scope_json, evidence_json, gap, expected_output,
            continuation, routing_proposal, inventory_revision, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        rusqlite::params![
            input.request_id,
            input.session_id,
            input.workflow_run_id,
            obligation.id,
            input.requester_agent_id,
            input.source_turn_id,
            input.target_role,
            input.purpose,
            input.question,
            input.scope_json,
            input.evidence_json,
            input.gap,
            input.expected_output,
            input.continuation,
            input.routing_proposal,
            input.inventory_revision,
            now,
        ],
    )?;
    hydrate_capability_obligation(conn, &mut obligation)?;
    Ok(obligation)
}

#[tauri::command]
pub async fn capability_need_record(
    state: State<'_, Db>,
    input: CapabilityNeedInput,
) -> Result<CapabilityObligationRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    record_capability_need(&conn, input)
}

const GENERATION_DEPTH_CAP: i64 = 3;
const GENERATION_ROOT_DESCENDANT_CAP: i64 = 20;
const GENERATION_RUN_CAP: i64 = 32;
const GENERATION_REPAIR_ATTEMPT_CAP: i64 = 2;
const GENERATION_STRUCTURAL_REPLAN_CAP: i64 = 1;
const ANCESTRY_WALK_CAP: usize = 64;

const EVIDENCE_INVENTORY_COLUMNS: &str =
    "id, session_id, workflow_run_id, agent_id, revision, entries_json, omitted_count, created_at";

const EVIDENCE_RECEIPT_COLUMNS: &str =
    "id, session_id, agent_id, source_turn_id, inventory_revision, source_id, requested_range, outcome, delivered_chars, reason, created_at";

fn evidence_inventory_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<EvidenceInventoryRow> {
    Ok(EvidenceInventoryRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        workflow_run_id: row.get(2)?,
        agent_id: row.get(3)?,
        revision: row.get(4)?,
        entries_json: row.get(5)?,
        omitted_count: row.get(6)?,
        created_at: crate::util::ms_to_iso(row.get(7)?),
    })
}

fn evidence_receipt_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<EvidenceDeliveryReceiptRow> {
    Ok(EvidenceDeliveryReceiptRow {
        id: row.get(0)?,
        session_id: row.get(1)?,
        agent_id: row.get(2)?,
        source_turn_id: row.get(3)?,
        inventory_revision: row.get(4)?,
        source_id: row.get(5)?,
        requested_range: row.get(6)?,
        outcome: row.get(7)?,
        delivered_chars: row.get(8)?,
        reason: row.get(9)?,
        created_at: crate::util::ms_to_iso(row.get(10)?),
    })
}

fn record_evidence_inventory(
    conn: &rusqlite::Connection,
    input: EvidenceInventoryInput,
) -> Result<EvidenceInventoryRow, PhaseError> {
    let id = format!("evidence-inventory:{}:{}", input.agent_id, input.revision);
    conn.execute(
        "INSERT OR IGNORE INTO evidence_inventories
           (id, session_id, workflow_run_id, agent_id, revision, entries_json, omitted_count, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            id,
            input.session_id,
            input.workflow_run_id,
            input.agent_id,
            input.revision,
            input.entries_json,
            input.omitted_count,
            crate::util::now_ms(),
        ],
    )?;
    let sql = format!(
        "SELECT {EVIDENCE_INVENTORY_COLUMNS} FROM evidence_inventories WHERE agent_id = ?1 AND revision = ?2"
    );
    conn.query_row(
        &sql,
        rusqlite::params![input.agent_id, input.revision],
        evidence_inventory_from_row,
    )
    .map_err(PhaseError::Db)
}

#[tauri::command]
pub async fn evidence_inventory_record(
    state: State<'_, Db>,
    input: EvidenceInventoryInput,
) -> Result<EvidenceInventoryRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    record_evidence_inventory(&conn, input)
}

fn list_evidence_receipts(
    conn: &rusqlite::Connection,
    agent_id: &str,
) -> Result<Vec<EvidenceDeliveryReceiptRow>, PhaseError> {
    let sql = format!(
        "SELECT {EVIDENCE_RECEIPT_COLUMNS} FROM evidence_delivery_receipts WHERE agent_id = ?1 ORDER BY created_at ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![agent_id], evidence_receipt_from_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

fn record_evidence_delivery(
    conn: &rusqlite::Connection,
    input: EvidenceDeliveryInput,
) -> Result<Vec<EvidenceDeliveryReceiptRow>, PhaseError> {
    let now = crate::util::now_ms();
    for receipt in input.receipts.iter() {
        let id = format!(
            "evidence-receipt:{}:{}:{}",
            input.agent_id, input.source_turn_id, receipt.source_id
        );
        conn.execute(
            "INSERT OR IGNORE INTO evidence_delivery_receipts
               (id, session_id, agent_id, source_turn_id, inventory_revision, source_id,
                requested_range, outcome, delivered_chars, reason, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                id,
                input.session_id,
                input.agent_id,
                input.source_turn_id,
                input.inventory_revision,
                receipt.source_id,
                receipt.requested_range,
                receipt.outcome,
                receipt.delivered_chars,
                receipt.reason,
                now,
            ],
        )?;
    }
    list_evidence_receipts(conn, &input.agent_id)
}

#[tauri::command]
pub async fn evidence_delivery_record(
    state: State<'_, Db>,
    input: EvidenceDeliveryInput,
) -> Result<Vec<EvidenceDeliveryReceiptRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    record_evidence_delivery(&conn, input)
}

enum LineageResolution {
    Resolved {
        causal_root_agent_id: Option<String>,
        parent_depth: i64,
    },
    Invalid(String),
}

fn resolve_lineage(
    conn: &rusqlite::Connection,
    session_id: &str,
    parent_agent_id: Option<&str>,
) -> Result<LineageResolution, PhaseError> {
    let Some(parent) = parent_agent_id else {
        return Ok(LineageResolution::Resolved {
            causal_root_agent_id: None,
            parent_depth: -1,
        });
    };
    let mut seen: Vec<String> = Vec::new();
    let mut cursor = parent.to_string();
    let mut root = parent.to_string();
    let mut structural_depth: i64 = 0;
    for step in 0..ANCESTRY_WALK_CAP {
        if seen.iter().any(|entry| entry == &cursor) {
            return Ok(LineageResolution::Invalid(
                "the parent lineage contains a cycle".to_string(),
            ));
        }
        seen.push(cursor.clone());
        let found = conn
            .query_row(
                "SELECT id, session_id, parent_agent_id FROM agents WHERE id = ?1",
                rusqlite::params![cursor],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .optional()?;
        let Some((id, row_session_id, parent_of_cursor)) = found else {
            return Ok(LineageResolution::Invalid(format!(
                "ancestor {cursor} is not on record"
            )));
        };
        if row_session_id != session_id {
            return Ok(LineageResolution::Invalid(format!(
                "ancestor {cursor} belongs to another session"
            )));
        }
        root = id;
        match parent_of_cursor {
            None => break,
            Some(next) => {
                if step == ANCESTRY_WALK_CAP - 1 {
                    return Ok(LineageResolution::Invalid(
                        "the parent lineage is deeper than the walk cap".to_string(),
                    ));
                }
                cursor = next;
                structural_depth += 1;
            }
        }
    }
    let parent_depth = conn
        .query_row(
            "SELECT depth FROM agent_generation_ledger WHERE agent_id = ?1 ORDER BY created_at DESC LIMIT 1",
            rusqlite::params![parent],
            |row| row.get::<_, i64>(0),
        )
        .optional()?
        .unwrap_or(0)
        .max(structural_depth);
    Ok(LineageResolution::Resolved {
        causal_root_agent_id: Some(root),
        parent_depth,
    })
}

fn count_of(
    conn: &rusqlite::Connection,
    sql: &str,
    value: &str,
) -> Result<i64, PhaseError> {
    conn.query_row(sql, rusqlite::params![value], |row| row.get::<_, i64>(0))
        .map_err(PhaseError::Db)
}

fn generation_refusal_scope(input: &GenerationReservationInput) -> String {
    match (input.parent_agent_id.as_deref(), input.workflow_run_id.as_deref()) {
        (Some(parent), _) => format!("agent:{parent}"),
        (None, Some(run)) => format!("run:{run}"),
        (None, None) => "session".to_string(),
    }
}

fn record_generation_refusal(
    conn: &rusqlite::Connection,
    input: &GenerationReservationInput,
    causal_root_agent_id: Option<&str>,
    limit: &str,
    reason: &str,
) -> Result<bool, PhaseError> {
    let changed = conn.execute(
        "INSERT OR IGNORE INTO generation_refusals
           (id, session_id, workflow_run_id, parent_agent_id, scope_key, causal_root_agent_id,
            obligation_id, limit_name, reason, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            format!("generation-refusal:{}", crate::util::uuid_v4()),
            input.session_id,
            input.workflow_run_id,
            input.parent_agent_id,
            generation_refusal_scope(input),
            causal_root_agent_id,
            input.obligation_id,
            limit,
            reason,
            crate::util::now_ms(),
        ],
    )?;
    Ok(changed > 0)
}

fn refused(
    conn: &rusqlite::Connection,
    input: &GenerationReservationInput,
    causal_root_agent_id: Option<&str>,
    limit: &str,
    reason: String,
) -> Result<GenerationReservationOutcome, PhaseError> {
    let is_first_refusal =
        record_generation_refusal(conn, input, causal_root_agent_id, limit, &reason)?;
    Ok(GenerationReservationOutcome {
        kind: "refused".to_string(),
        reservations: Vec::new(),
        limit: Some(limit.to_string()),
        reason: Some(reason),
        is_first_refusal,
    })
}

fn reserve_agent_generation(
    conn: &mut rusqlite::Connection,
    input: GenerationReservationInput,
) -> Result<GenerationReservationOutcome, PhaseError> {
    let tx = conn.transaction()?;
    let lineage = resolve_lineage(&tx, &input.session_id, input.parent_agent_id.as_deref())?;
    let (causal_root, parent_depth) = match lineage {
        LineageResolution::Invalid(reason) => {
            let outcome = refused(&tx, &input, None, "lineage", reason)?;
            tx.commit()?;
            return Ok(outcome);
        }
        LineageResolution::Resolved {
            causal_root_agent_id,
            parent_depth,
        } => (causal_root_agent_id, parent_depth),
    };
    let depth = parent_depth + 1;
    if depth > GENERATION_DEPTH_CAP {
        let outcome = refused(
            &tx,
            &input,
            causal_root.as_deref(),
            "depth",
            format!("capability generation depth {depth} is past the cap of {GENERATION_DEPTH_CAP}"),
        )?;
        tx.commit()?;
        return Ok(outcome);
    }
    let root_descendants = match causal_root.as_deref() {
        None => 0,
        Some(root) => count_of(
            &tx,
            "SELECT COUNT(*) FROM agent_generation_ledger WHERE causal_root_agent_id = ?1 AND depth > 0",
            root,
        )?,
    };
    if root_descendants + input.count > GENERATION_ROOT_DESCENDANT_CAP {
        let outcome = refused(
            &tx,
            &input,
            causal_root.as_deref(),
            "root-descendants",
            format!("this causal root already generated {root_descendants} of {GENERATION_ROOT_DESCENDANT_CAP} agents"),
        )?;
        tx.commit()?;
        return Ok(outcome);
    }
    let run_descendants = match input.workflow_run_id.as_deref() {
        None => 0,
        Some(run) => count_of(
            &tx,
            "SELECT COUNT(*) FROM agent_generation_ledger WHERE workflow_run_id = ?1",
            run,
        )?,
    };
    if run_descendants + input.count > GENERATION_RUN_CAP {
        let outcome = refused(
            &tx,
            &input,
            causal_root.as_deref(),
            "run-descendants",
            format!("this run already generated {run_descendants} of {GENERATION_RUN_CAP} agents"),
        )?;
        tx.commit()?;
        return Ok(outcome);
    }
    if let Some(obligation) = input.obligation_id.as_deref() {
        let attempts = count_of(
            &tx,
            "SELECT COUNT(*) FROM agent_generation_ledger WHERE obligation_id = ?1",
            obligation,
        )?;
        if attempts + input.count > GENERATION_REPAIR_ATTEMPT_CAP {
            let outcome = refused(
                &tx,
                &input,
                causal_root.as_deref(),
                "repair-attempts",
                format!("this obligation already took {attempts} of {GENERATION_REPAIR_ATTEMPT_CAP} automatic attempts"),
            )?;
            tx.commit()?;
            return Ok(outcome);
        }
    }
    if input.purpose.as_deref() == Some("replan") {
        if let Some(run) = input.workflow_run_id.as_deref() {
            let replans = count_of(
                &tx,
                "SELECT COUNT(*) FROM agent_generation_ledger WHERE workflow_run_id = ?1 AND purpose = 'replan'",
                run,
            )?;
            if replans + input.count > GENERATION_STRUCTURAL_REPLAN_CAP {
                let outcome = refused(
                    &tx,
                    &input,
                    causal_root.as_deref(),
                    "structural-replans",
                    format!("this run already took {replans} of {GENERATION_STRUCTURAL_REPLAN_CAP} automatic structural replans"),
                )?;
                tx.commit()?;
                return Ok(outcome);
            }
        }
    }
    let now = crate::util::now_ms();
    let attempt = format!("{}:{}", input.reservation_id, crate::util::uuid_v4());
    let mut reservations: Vec<GenerationReservationRow> = Vec::new();
    for index in 0..input.count {
        let id = format!("{attempt}:{index}");
        tx.execute(
            "INSERT INTO agent_generation_ledger
               (id, session_id, workflow_run_id, parent_agent_id, causal_root_agent_id, agent_id,
                depth, creation_path, obligation_id, purpose, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                id,
                input.session_id,
                input.workflow_run_id,
                input.parent_agent_id,
                causal_root.clone().unwrap_or_else(|| id.clone()),
                depth,
                input.creation_path,
                input.obligation_id,
                input.purpose,
                now,
            ],
        )?;
        reservations.push(GenerationReservationRow {
            reservation_id: id,
            depth,
            causal_root_agent_id: causal_root.clone(),
        });
    }
    tx.commit()?;
    Ok(GenerationReservationOutcome {
        kind: "granted".to_string(),
        reservations,
        limit: None,
        reason: None,
        is_first_refusal: false,
    })
}

#[tauri::command]
pub async fn agent_generation_reserve(
    state: State<'_, Db>,
    input: GenerationReservationInput,
) -> Result<GenerationReservationOutcome, PhaseError> {
    let mut conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    reserve_agent_generation(&mut conn, input)
}

fn bind_generation_reservation(
    conn: &rusqlite::Connection,
    reservation_id: &str,
    agent_id: &str,
) -> Result<(), PhaseError> {
    let changed = conn.execute(
        "UPDATE agent_generation_ledger
            SET agent_id = ?1,
                causal_root_agent_id = CASE WHEN parent_agent_id IS NULL THEN ?1 ELSE causal_root_agent_id END
          WHERE id = ?2 AND agent_id IS NULL",
        rusqlite::params![agent_id, reservation_id],
    )?;
    if changed == 0 {
        return Err(PhaseError::ReservationNotBindable(format!(
            "reservation {reservation_id} is missing or already bound to an agent"
        )));
    }
    Ok(())
}

fn capability_purpose_for_finding_target(target: &str) -> Option<&'static str> {
    match target {
        "implementer" => Some("repair"),
        "planner" => Some("replan"),
        "investigator" => Some("diagnosis"),
        "tester" => Some("test"),
        _ => None,
    }
}

fn associate_hold_obligations(
    conn: &rusqlite::Connection,
    hold: &ClusterCompletionHoldRow,
) -> Result<(), PhaseError> {
    let parsed: serde_json::Value = match serde_json::from_str(&hold.findings_json) {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };
    let Some(findings) = parsed.as_array() else {
        return Ok(());
    };
    let now = crate::util::now_ms();
    for finding in findings.iter() {
        let Some(target) = finding.get("target").and_then(|value| value.as_str()) else {
            continue;
        };
        let Some(purpose) = capability_purpose_for_finding_target(target) else {
            continue;
        };
        let identity = format!("{}:{}:{}", hold.source_agent_id, target, purpose);
        let obligation_id = format!("capability-obligation:{identity}");
        let obligation = insert_capability_obligation(
            conn,
            CapabilityObligationSeed {
                id: &obligation_id,
                session_id: &hold.session_id,
                workflow_run_id: hold.workflow_run_id.as_deref(),
                identity: &identity,
                requester_agent_id: &hold.source_agent_id,
                target_role: target,
                purpose,
            },
        )?;
        conn.execute(
            "INSERT OR IGNORE INTO capability_obligation_holds (obligation_id, hold_id, created_at)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![obligation.id, hold.id, now],
        )?;
    }
    Ok(())
}

fn resolve_cluster_completion_hold(
    conn: &rusqlite::Connection,
    input: ClusterCompletionHoldResolutionInput,
) -> Result<(), PhaseError> {
    let evidence = input.resolution_evidence.trim();
    if evidence.is_empty() {
        return Err(PhaseError::InvalidHoldResolution);
    }
    let now = crate::util::now_ms();
    conn.execute(
        "UPDATE cluster_completion_holds
            SET state = 'resolved', resolution_evidence = ?2, resolved_at = ?3, updated_at = ?3
          WHERE id = ?1 AND state = 'open'",
        rusqlite::params![input.id, evidence, now],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn cluster_completion_hold_resolve(
    state: State<'_, Db>,
    input: ClusterCompletionHoldResolutionInput,
) -> Result<(), PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    resolve_cluster_completion_hold(&conn, input)
}

const CLUSTER_EXECUTION_GRAPH_COLUMNS: &str =
    "container_agent_id, session_id, workflow_run_id, plan_id, goal_title, execution_version, graph_json, created_at";

fn cluster_execution_graph_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ClusterExecutionGraphRow> {
    Ok(ClusterExecutionGraphRow {
        container_agent_id: row.get(0)?,
        session_id: row.get(1)?,
        workflow_run_id: row.get(2)?,
        plan_id: row.get(3)?,
        goal_title: row.get(4)?,
        execution_version: row.get(5)?,
        graph_json: row.get(6)?,
        created_at: crate::util::ms_to_iso(row.get(7)?),
        nodes: Vec::new(),
    })
}

fn cluster_execution_nodes(
    conn: &rusqlite::Connection,
    container_agent_id: &str,
) -> Result<Vec<ClusterExecutionNodeRow>, PhaseError> {
    let mut stmt = conn.prepare(
        "SELECT node_id, agent_id, ordinal, role FROM cluster_execution_nodes WHERE container_agent_id = ?1 ORDER BY ordinal ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![container_agent_id], |row| {
        Ok(ClusterExecutionNodeRow {
            node_id: row.get(0)?,
            agent_id: row.get(1)?,
            ordinal: row.get(2)?,
            role: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

fn list_cluster_execution_graphs(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<Vec<ClusterExecutionGraphRow>, PhaseError> {
    let sql = format!(
        "SELECT {CLUSTER_EXECUTION_GRAPH_COLUMNS} FROM cluster_execution_graphs WHERE session_id = ?1 ORDER BY created_at ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(
        rusqlite::params![session_id],
        cluster_execution_graph_from_row,
    )?;
    let mut graphs = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(PhaseError::Db)?;
    for graph in graphs.iter_mut() {
        graph.nodes = cluster_execution_nodes(conn, &graph.container_agent_id)?;
    }
    Ok(graphs)
}

#[tauri::command]
pub async fn cluster_execution_graphs_for_session(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Vec<ClusterExecutionGraphRow>, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    list_cluster_execution_graphs(&conn, &session_id)
}

fn record_cluster_execution_graph(
    conn: &rusqlite::Connection,
    input: ClusterExecutionGraphInput,
) -> Result<ClusterExecutionGraphRow, PhaseError> {
    let now = crate::util::now_ms();
    let transaction = conn.unchecked_transaction()?;
    let created = transaction.execute(
        "INSERT OR IGNORE INTO cluster_execution_graphs
           (container_agent_id, session_id, workflow_run_id, plan_id, goal_title,
            execution_version, graph_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            input.container_agent_id,
            input.session_id,
            input.workflow_run_id,
            input.plan_id,
            input.goal_title,
            input.execution_version,
            input.graph_json,
            now,
        ],
    )?;
    let nodes_to_record = if created == 1 {
        input.nodes.as_slice()
    } else {
        &[]
    };
    for node in nodes_to_record {
        transaction.execute(
            "INSERT OR IGNORE INTO cluster_execution_nodes
               (container_agent_id, node_id, agent_id, ordinal, role)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                input.container_agent_id,
                node.node_id,
                node.agent_id,
                node.ordinal,
                node.role,
            ],
        )?;
    }
    transaction.commit()?;
    let sql = format!(
        "SELECT {CLUSTER_EXECUTION_GRAPH_COLUMNS} FROM cluster_execution_graphs WHERE container_agent_id = ?1"
    );
    let mut graph = conn
        .query_row(
            &sql,
            rusqlite::params![input.container_agent_id],
            cluster_execution_graph_from_row,
        )
        .map_err(PhaseError::Db)?;
    graph.nodes = cluster_execution_nodes(conn, &graph.container_agent_id)?;
    Ok(graph)
}

#[tauri::command]
pub async fn cluster_execution_graph_record(
    state: State<'_, Db>,
    input: ClusterExecutionGraphInput,
) -> Result<ClusterExecutionGraphRow, PhaseError> {
    let conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    record_cluster_execution_graph(&conn, input)
}

const AGENT_INSERT_SQL: &str = "INSERT INTO agents
   (id, session_id, step_id, ordinal, name, status,
    provider_run_id, output_summary, started_at, last_finished_at, kind, verbosity,
    effort, model_override, provider_override,
    parent_agent_id, workflow_run_id, source_thread_id, source_thread_ids, source_comment_url, source_kind,
    domains_json, routing_lock, routing_decision, task_profile, execution_purpose)
 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26)";

fn insert_agent_row(
    conn: &rusqlite::Connection,
    input: PhaseRunInsertInput,
) -> Result<SessionRow, PhaseError> {
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
            input.routing_lock,
            input.routing_decision,
            input.task_profile,
            input.execution_purpose,
        ],
    )?;
    if let Some(reservation_id) = input.generation_reservation_id.as_deref() {
        bind_generation_reservation(conn, reservation_id, &id)?;
    }

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
        routing_lock: input.routing_lock,
        routing_decision: input.routing_decision,
        task_profile: input.task_profile,
        execution_purpose: input.execution_purpose,
    })
}

#[tauri::command]
pub async fn agent_insert(
    state: State<'_, Db>,
    input: PhaseRunInsertInput,
) -> Result<SessionRow, PhaseError> {
    let mut conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    insert_agent(&mut conn, input)
}

fn insert_agent(
    conn: &mut rusqlite::Connection,
    input: PhaseRunInsertInput,
) -> Result<SessionRow, PhaseError> {
    validate_routing_values(
        input.routing_lock.as_ref(),
        input.routing_decision.as_ref(),
        input.task_profile.as_ref(),
    )?;
    let transaction = conn.transaction()?;
    let row = insert_agent_row(&transaction, input)?;
    transaction.commit()?;
    Ok(row)
}

fn children_of_parent(
    conn: &rusqlite::Connection,
    parent_agent_id: &str,
) -> Result<Vec<SessionRow>, PhaseError> {
    let sql = format!(
        "SELECT {cols} FROM live_agents WHERE parent_agent_id = ?1 ORDER BY ordinal ASC",
        cols = AGENT_SESSION_COLS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params![parent_agent_id], session_row_from_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(PhaseError::Db)
}

fn insert_agent_batch(
    conn: &mut rusqlite::Connection,
    parent_agent_id: &str,
    children: Vec<PhaseRunInsertInput>,
) -> Result<AgentBatchInsertOutcome, PhaseError> {
    for child in &children {
        validate_routing_values(
            child.routing_lock.as_ref(),
            child.routing_decision.as_ref(),
            child.task_profile.as_ref(),
        )?;
    }
    let transaction = conn.transaction()?;
    let existing = children_of_parent(&transaction, parent_agent_id)?;
    if !existing.is_empty() || children.is_empty() {
        return Ok(AgentBatchInsertOutcome {
            inserted: false,
            agents: existing,
        });
    }
    let mut agents = Vec::with_capacity(children.len());
    for child in children {
        let owned = PhaseRunInsertInput {
            parent_agent_id: Some(parent_agent_id.to_string()),
            ..child
        };
        agents.push(insert_agent_row(&transaction, owned)?);
    }
    transaction.commit()?;
    Ok(AgentBatchInsertOutcome {
        inserted: true,
        agents,
    })
}

#[tauri::command]
pub async fn agent_insert_batch(
    state: State<'_, Db>,
    input: AgentBatchInsertInput,
) -> Result<AgentBatchInsertOutcome, PhaseError> {
    let mut conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    insert_agent_batch(&mut conn, &input.parent_agent_id, input.children)
}

#[tauri::command]
pub async fn workflow_node_routing_update(
    state: State<'_, Db>,
    input: WorkflowNodeRoutingUpdateInput,
) -> Result<(), PhaseError> {
    validate_routing_values(
        input.routing_lock.as_ref(),
        Some(&input.routing_decision),
        input.task_profile.as_ref(),
    )?;
    let mut conn = state.0.lock().map_err(|_| PhaseError::Poisoned)?;
    let transaction = conn.transaction()?;
    let affected = match input.node_kind.as_str() {
        "agent" => {
            let status: Option<String> = transaction
                .query_row(
                    "SELECT status FROM agents WHERE id = ?1",
                    rusqlite::params![input.id],
                    |row| row.get(0),
                )
                .optional()?;
            let Some(status) = status else {
                return Err(PhaseError::RunNotFound(input.id));
            };
            if matches!(status.as_str(), "starting" | "running" | "completed") {
                return Err(PhaseError::NodeNotMutable(input.id));
            }
            transaction.execute(
                "UPDATE agents SET routing_lock = ?2, routing_decision = ?3, task_profile = ?4,
                 provider_override = ?5, model_override = ?6, effort = ?7 WHERE id = ?1",
                rusqlite::params![
                    input.id,
                    input.routing_lock,
                    input.routing_decision,
                    input.task_profile,
                    input.provider_override,
                    input.model_override,
                    input.effort,
                ],
            )?
        }
        "step" => {
            let blocked: bool = transaction.query_row(
                "SELECT EXISTS(SELECT 1 FROM live_agents WHERE step_id = ?1 AND status IN ('starting', 'running', 'completed'))",
                rusqlite::params![input.id],
                |row| row.get(0),
            )?;
            if blocked {
                return Err(PhaseError::NodeNotMutable(input.id));
            }
            transaction.execute(
                "UPDATE steps SET routing_lock = ?2, routing_decision = ?3, task_profile = ?4,
                 provider_override = ?5, model_override = ?6, effort = ?7 WHERE id = ?1",
                rusqlite::params![
                    input.id,
                    input.routing_lock,
                    input.routing_decision,
                    input.task_profile,
                    input.provider_override,
                    input.model_override,
                    input.effort,
                ],
            )?
        }
        _ => return Err(PhaseError::InvalidRouting),
    };
    if affected == 0 {
        return Err(PhaseError::TemplateNotFound(input.id));
    }
    transaction.commit()?;
    Ok(())
}

#[tauri::command]
pub async fn agent_update_status(
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
pub async fn agent_set_kind(
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
pub async fn agent_set_verbosity(
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
pub async fn agent_set_provider_session_id(
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
pub async fn agent_mark_viewed(
    state: State<'_, Db>,
    id: String,
    at: String,
) -> Result<(), PhaseError> {
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
pub async fn agent_set_done(
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

    fn agents_table_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE agents (
                id TEXT PRIMARY KEY, session_id TEXT, step_id TEXT, ordinal INTEGER, name TEXT, status TEXT,
                provider_run_id TEXT, output_summary TEXT, started_at TEXT,
                provider_session_id TEXT, provider_session_provider_id TEXT, last_finished_at TEXT, last_viewed_at TEXT, done_at TEXT,
                kind TEXT, verbosity TEXT, effort TEXT, model_override TEXT, provider_override TEXT,
                parent_agent_id TEXT, workflow_run_id TEXT, source_thread_id TEXT,
                source_thread_ids TEXT, source_comment_url TEXT, source_kind TEXT, domains_json TEXT,
                routing_lock TEXT, routing_decision TEXT, task_profile TEXT, execution_purpose TEXT, deleted_at INTEGER
            );
            CREATE VIEW live_agents AS SELECT * FROM agents WHERE deleted_at IS NULL;",
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
              ON workflows(workspace_id, name) WHERE deleted_at IS NULL AND is_preset = 1;",
        )
        .unwrap();
        conn
    }

    fn completion_holds_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE cluster_completion_holds (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                workflow_run_id TEXT,
                container_agent_id TEXT NOT NULL,
                source_agent_id TEXT NOT NULL,
                source_turn_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                findings_json TEXT NOT NULL,
                state TEXT NOT NULL,
                resolution_evidence TEXT,
                resolved_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE (source_agent_id, source_turn_id)
            );
            CREATE TABLE capability_obligations (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                workflow_run_id TEXT,
                identity TEXT NOT NULL UNIQUE,
                requester_agent_id TEXT NOT NULL,
                target_role TEXT NOT NULL,
                purpose TEXT NOT NULL,
                state TEXT NOT NULL,
                owner_agent_id TEXT,
                decision TEXT,
                child_agent_id TEXT,
                delivered_at INTEGER,
                delivery_receipt TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE capability_requests (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                workflow_run_id TEXT,
                obligation_id TEXT NOT NULL,
                requester_agent_id TEXT NOT NULL,
                source_turn_id TEXT NOT NULL,
                target_role TEXT NOT NULL,
                purpose TEXT NOT NULL,
                question TEXT NOT NULL,
                scope_json TEXT NOT NULL,
                evidence_json TEXT NOT NULL,
                gap TEXT NOT NULL,
                expected_output TEXT NOT NULL,
                continuation TEXT NOT NULL,
                routing_proposal TEXT,
                inventory_revision TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL,
                UNIQUE (requester_agent_id, source_turn_id)
            );
            CREATE TABLE capability_obligation_holds (
                obligation_id TEXT NOT NULL,
                hold_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (obligation_id, hold_id)
            );",
        )
        .unwrap();
        conn
    }

    fn capability_need_input(request_id: &str) -> CapabilityNeedInput {
        CapabilityNeedInput {
            request_id: request_id.to_string(),
            obligation_id: "capability-obligation:source:implementer:repair".to_string(),
            identity: "source:implementer:repair".to_string(),
            session_id: "session".to_string(),
            workflow_run_id: Some("run".to_string()),
            requester_agent_id: "source".to_string(),
            source_turn_id: "turn".to_string(),
            target_role: "implementer".to_string(),
            purpose: "repair".to_string(),
            question: "restore the dropped guard".to_string(),
            scope_json: "[\"apps/desktop/src/store/slices/turn/sendTurn.ts\"]".to_string(),
            evidence_json: "[\"review:finding-1\"]".to_string(),
            gap: "the failing path was never executed".to_string(),
            expected_output: "the guard back with a regression test".to_string(),
            continuation: "handoff".to_string(),
            routing_proposal: None,
            inventory_revision: "rabc123".to_string(),
        }
    }

    fn completion_hold_input(id: &str) -> ClusterCompletionHoldInput {
        ClusterCompletionHoldInput {
            id: id.to_string(),
            session_id: "session".to_string(),
            workflow_run_id: Some("run".to_string()),
            container_agent_id: "container".to_string(),
            source_agent_id: "source".to_string(),
            source_turn_id: "turn".to_string(),
            reason: "missing-outcome".to_string(),
            findings_json: "[]".to_string(),
        }
    }

    #[test]
    fn cluster_completion_hold_record_is_idempotent() {
        let conn = completion_holds_conn();
        let first = record_cluster_completion_hold(&conn, completion_hold_input("hold-1")).unwrap();
        let duplicate =
            record_cluster_completion_hold(&conn, completion_hold_input("hold-2")).unwrap();
        let rows = list_cluster_completion_holds(&conn, "session").unwrap();

        assert_eq!(first.id, "hold-1");
        assert_eq!(duplicate.id, "hold-1");
        assert_eq!(rows.len(), 1);
    }

    #[test]
    fn capability_need_record_is_idempotent_per_turn() {
        let conn = completion_holds_conn();
        record_capability_need(&conn, capability_need_input("request-1")).unwrap();
        let duplicate = record_capability_need(&conn, capability_need_input("request-2")).unwrap();
        let obligations = list_capability_obligations(&conn, "session").unwrap();

        assert_eq!(obligations.len(), 1);
        assert_eq!(duplicate.requests.len(), 1);
        assert_eq!(obligations[0].requests[0].id, "request-1");
        assert_eq!(obligations[0].state, "open");
    }

    #[test]
    fn unresolved_hold_and_matching_need_share_one_obligation() {
        let conn = completion_holds_conn();
        let mut hold = completion_hold_input("hold-1");
        hold.reason = "unresolved-outcome".to_string();
        hold.findings_json =
            "[{\"reason\":\"the guard is gone\",\"target\":\"implementer\"}]".to_string();
        record_cluster_completion_hold(&conn, hold).unwrap();
        record_capability_need(&conn, capability_need_input("request-1")).unwrap();

        let obligations = list_capability_obligations(&conn, "session").unwrap();

        assert_eq!(obligations.len(), 1);
        assert_eq!(obligations[0].hold_ids, vec!["hold-1".to_string()]);
        assert_eq!(obligations[0].requests.len(), 1);
    }

    fn execution_graphs_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE cluster_execution_graphs (
                container_agent_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                workflow_run_id TEXT,
                plan_id TEXT,
                goal_title TEXT NOT NULL,
                execution_version INTEGER NOT NULL,
                graph_json TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE cluster_execution_nodes (
                container_agent_id TEXT NOT NULL,
                node_id TEXT NOT NULL,
                agent_id TEXT,
                ordinal INTEGER NOT NULL,
                role TEXT NOT NULL,
                PRIMARY KEY (container_agent_id, node_id)
            );",
        )
        .unwrap();
        conn
    }

    fn execution_graph_input(graph_json: &str) -> ClusterExecutionGraphInput {
        ClusterExecutionGraphInput {
            container_agent_id: "container".to_string(),
            session_id: "session".to_string(),
            workflow_run_id: Some("run".to_string()),
            plan_id: Some("plan".to_string()),
            goal_title: "goal".to_string(),
            execution_version: 2,
            graph_json: graph_json.to_string(),
            nodes: vec![ClusterExecutionNodeRow {
                node_id: "discovery".to_string(),
                agent_id: Some("agent-1".to_string()),
                ordinal: 0,
                role: "scout".to_string(),
            }],
        }
    }

    #[test]
    fn cluster_execution_graph_snapshot_is_immutable_once_recorded() {
        let conn = execution_graphs_conn();
        record_cluster_execution_graph(&conn, execution_graph_input("[{\"id\":\"discovery\"}]"))
            .unwrap();
        let second =
            record_cluster_execution_graph(&conn, execution_graph_input("[{\"id\":\"edited\"}]"))
                .unwrap();
        let rows = list_cluster_execution_graphs(&conn, "session").unwrap();

        assert_eq!(second.graph_json, "[{\"id\":\"discovery\"}]");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].nodes.len(), 1);
        assert_eq!(rows[0].nodes[0].role, "scout");
    }

    #[test]
    fn cluster_execution_graph_rerecord_adds_no_node_binding() {
        let conn = execution_graphs_conn();
        record_cluster_execution_graph(&conn, execution_graph_input("[{\"id\":\"discovery\"}]"))
            .unwrap();
        let mut repeat = execution_graph_input("[{\"id\":\"discovery\"}]");
        repeat.nodes.push(ClusterExecutionNodeRow {
            node_id: "extra".to_string(),
            agent_id: Some("agent-2".to_string()),
            ordinal: 1,
            role: "tester".to_string(),
        });
        let second = record_cluster_execution_graph(&conn, repeat).unwrap();

        assert_eq!(second.nodes.len(), 1);
        assert_eq!(second.nodes[0].node_id, "discovery");
    }

    #[test]
    fn cluster_execution_graph_record_rolls_back_on_a_failed_node() {
        let conn = execution_graphs_conn();
        conn.execute_batch(
            "CREATE TRIGGER reject_extra BEFORE INSERT ON cluster_execution_nodes
             WHEN NEW.node_id = 'extra' BEGIN SELECT RAISE(ABORT, 'rejected'); END;",
        )
        .unwrap();
        let mut failing = execution_graph_input("[{\"id\":\"discovery\"}]");
        failing.nodes.push(ClusterExecutionNodeRow {
            node_id: "extra".to_string(),
            agent_id: None,
            ordinal: 1,
            role: "tester".to_string(),
        });

        assert!(record_cluster_execution_graph(&conn, failing).is_err());
        assert!(list_cluster_execution_graphs(&conn, "session")
            .unwrap()
            .is_empty());
    }

    #[test]
    fn cluster_completion_hold_resolution_records_evidence() {
        let conn = completion_holds_conn();
        record_cluster_completion_hold(&conn, completion_hold_input("hold-1")).unwrap();
        resolve_cluster_completion_hold(
            &conn,
            ClusterCompletionHoldResolutionInput {
                id: "hold-1".to_string(),
                resolution_evidence: "verified repair".to_string(),
            },
        )
        .unwrap();
        let rows = list_cluster_completion_holds(&conn, "session").unwrap();

        assert_eq!(rows[0].state, "resolved");
        assert_eq!(
            rows[0].resolution_evidence.as_deref(),
            Some("verified repair")
        );
    }

    fn insert_workflow(
        conn: &rusqlite::Connection,
        id: &str,
        name: &str,
        deleted: Option<i64>,
        is_preset: bool,
    ) {
        conn.execute(
            "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, deleted_at, is_preset)
             VALUES (?1, 'ws1', ?2, '', '2026-01-01', '2026-01-01', ?3, ?4)",
            rusqlite::params![id, name, deleted, is_preset as i32],
        )
        .unwrap();
    }

    #[test]
    fn resolve_live_name_keeps_a_free_name() {
        let conn = workflows_table_conn();
        insert_workflow(&conn, "w1", "Orchestrated workflow", Some(1), true);
        let name = resolve_live_name(&conn, "ws1", "Orchestrated workflow", "w2", true).unwrap();
        assert_eq!(name, "Orchestrated workflow");
    }

    #[test]
    fn resolve_live_name_suffixes_against_live_rows() {
        let conn = workflows_table_conn();
        insert_workflow(&conn, "w1", "Orchestrated workflow", None, true);
        insert_workflow(&conn, "w2", "Orchestrated workflow 2", None, true);
        let name = resolve_live_name(&conn, "ws1", "Orchestrated workflow", "w3", true).unwrap();
        assert_eq!(name, "Orchestrated workflow 3");
    }

    #[test]
    fn resolve_live_name_ignores_the_row_being_updated() {
        let conn = workflows_table_conn();
        insert_workflow(&conn, "w1", "Ship It", None, true);
        let name = resolve_live_name(&conn, "ws1", "Ship It", "w1", true).unwrap();
        assert_eq!(name, "Ship It");
    }

    #[test]
    fn resolve_live_name_keeps_the_preset_name_on_a_run_copy() {
        let conn = workflows_table_conn();
        insert_workflow(&conn, "w1", "Ship it", None, true);
        let name = resolve_live_name(&conn, "ws1", "Ship it", "w2", false).unwrap();
        assert_eq!(name, "Ship it");
        insert_workflow(&conn, "w2", &name, None, false);
    }

    #[test]
    fn resolve_live_name_ignores_live_run_copies_for_a_preset() {
        let conn = workflows_table_conn();
        insert_workflow(&conn, "w1", "Ship it", None, false);
        let name = resolve_live_name(&conn, "ws1", "Ship it", "w2", true).unwrap();
        assert_eq!(name, "Ship it");
    }

    #[test]
    fn resolve_live_name_suffixes_a_run_copy_promoted_to_preset() {
        let conn = workflows_table_conn();
        insert_workflow(&conn, "w1", "Ship it", None, true);
        insert_workflow(&conn, "w2", "Ship it", None, false);
        let name = resolve_live_name(&conn, "ws1", "Ship it", "w2", true).unwrap();
        assert_eq!(name, "Ship it 2");
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
        assert!(row.routing_lock.is_none());
        assert!(row.routing_decision.is_none());
        assert!(row.task_profile.is_none());
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
        assert!(row.routing_lock.is_none());
        assert!(row.routing_decision.is_none());
        assert!(row.task_profile.is_none());
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
                None::<String>,
                None::<String>,
                None::<String>,
                "cluster",
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
        assert_eq!(row.execution_purpose.as_deref(), Some("cluster"));
    }

    #[test]
    fn validates_bounded_routing_objects() {
        let lock = r#"{"version":1,"pick":{"provider":"codex","model":"gpt-5.6","effort":"high"},"origin":"user"}"#.to_string();
        let decision = r#"{"version":1,"proposal":null,"selected":{"provider":"codex","model":"gpt-5.6","effort":"high"},"source":"step_lock","reason":"Chosen","adjustment":"none","executed":null}"#.to_string();
        let profile =
            r#"{"taskType":"implementation","difficulty":"heavy","basis":"agent"}"#.to_string();
        assert!(validate_routing_values(Some(&lock), Some(&decision), Some(&profile)).is_ok());

        let oversized = format!(
            r#"{{"version":1,"proposal":null,"selected":{{"provider":"codex","model":"gpt-5.6","effort":"high"}},"source":"step_lock","reason":"{}","adjustment":"none","executed":null}}"#,
            "x".repeat(241)
        );
        assert!(validate_routing_values(None, Some(&oversized), None).is_err());
    }

    #[test]
    fn rejects_a_routing_lock_with_an_unknown_provider() {
        let lock = r#"{"version":1,"pick":{"provider":"nowhere","model":"gpt-5.6","effort":"high"},"origin":"user"}"#.to_string();
        assert!(validate_routing_values(Some(&lock), None, None).is_err());
    }

    fn child_input(id: &str, ordinal: i64) -> PhaseRunInsertInput {
        PhaseRunInsertInput {
            id: Some(id.to_string()),
            session_id: "s1".to_string(),
            step_id: None,
            ordinal,
            name: format!("cluster {ordinal}"),
            status: "pending".to_string(),
            provider_run_id: None,
            output_summary: None,
            started_at: None,
            completed_at: None,
            kind: Some("implementer".to_string()),
            verbosity: None,
            effort: Some("high".to_string()),
            model_override: Some("gpt-5.6".to_string()),
            provider_override: Some("codex".to_string()),
            parent_agent_id: None,
            workflow_run_id: Some("run-1".to_string()),
            source_thread_id: None,
            source_thread_ids: None,
            source_comment_url: None,
            source_kind: None,
            domains_json: None,
            routing_lock: None,
            routing_decision: Some(
                r#"{"version":1,"proposal":null,"selected":{"provider":"codex","model":"gpt-5.6","effort":"high"},"source":"agent","reason":"Chosen","adjustment":"none","executed":null}"#
                    .to_string(),
            ),
            task_profile: Some(
                r#"{"taskType":"implementation","difficulty":"heavy","basis":"agent"}"#.to_string(),
            ),
            execution_purpose: Some("cluster".to_string()),
            generation_reservation_id: None,
        }
    }

    fn child_count(conn: &rusqlite::Connection, parent_agent_id: &str) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM agents WHERE parent_agent_id = ?1",
            rusqlite::params![parent_agent_id],
            |row| row.get(0),
        )
        .unwrap()
    }

    #[test]
    fn agent_insert_batch_commits_every_child_at_once() {
        let mut conn = agents_table_conn();

        let outcome = insert_agent_batch(
            &mut conn,
            "container",
            vec![
                child_input("c1", 0),
                child_input("c2", 1),
                child_input("c3", 2),
            ],
        )
        .unwrap();

        assert!(outcome.inserted);
        assert_eq!(outcome.agents.len(), 3);
        assert_eq!(child_count(&conn, "container"), 3);
        let stored = children_of_parent(&conn, "container").unwrap();
        assert_eq!(
            stored.iter().map(|row| row.id.as_str()).collect::<Vec<_>>(),
            vec!["c1", "c2", "c3"]
        );
        assert_eq!(stored[0].provider_override.as_deref(), Some("codex"));
        assert_eq!(stored[0].model_override.as_deref(), Some("gpt-5.6"));
        assert_eq!(stored[0].effort.as_deref(), Some("high"));
        assert!(stored[0].routing_decision.is_some());
        assert!(stored[0].task_profile.is_some());
    }

    #[test]
    fn agent_insert_batch_leaves_no_children_when_one_insert_fails() {
        let mut conn = agents_table_conn();
        conn.execute(
            "INSERT INTO agents (id, session_id, ordinal, name, status)
             VALUES ('c2', 's1', 9, 'taken', 'pending')",
            [],
        )
        .unwrap();

        let failure = insert_agent_batch(
            &mut conn,
            "container",
            vec![
                child_input("c1", 0),
                child_input("c2", 1),
                child_input("c3", 2),
            ],
        );

        assert!(failure.is_err());
        assert_eq!(child_count(&conn, "container"), 0);
        assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM agents WHERE id IN ('c1', 'c3')",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
            0
        );
    }

    #[test]
    fn agent_insert_batch_rejects_invalid_routing_before_writing_anything() {
        let mut conn = agents_table_conn();
        let mut broken = child_input("c2", 1);
        broken.task_profile = Some(r#"{"taskType":"nonsense"}"#.to_string());

        let failure =
            insert_agent_batch(&mut conn, "container", vec![child_input("c1", 0), broken]);

        assert!(matches!(failure, Err(PhaseError::InvalidRouting)));
        assert_eq!(child_count(&conn, "container"), 0);
    }

    #[test]
    fn agent_insert_batch_does_not_give_a_parent_a_second_batch() {
        let mut conn = agents_table_conn();
        insert_agent_batch(
            &mut conn,
            "container",
            vec![child_input("c1", 0), child_input("c2", 1)],
        )
        .unwrap();

        let outcome = insert_agent_batch(
            &mut conn,
            "container",
            vec![child_input("c3", 2), child_input("c4", 3)],
        )
        .unwrap();

        assert!(!outcome.inserted);
        assert_eq!(
            outcome
                .agents
                .iter()
                .map(|row| row.id.as_str())
                .collect::<Vec<_>>(),
            vec!["c1", "c2"]
        );
        assert_eq!(child_count(&conn, "container"), 2);
    }

    #[test]
    fn children_of_parent_skips_tombstoned_children() {
        let mut conn = agents_table_conn();
        insert_agent_batch(
            &mut conn,
            "container",
            vec![child_input("c1", 0), child_input("c2", 1)],
        )
        .unwrap();
        conn.execute("UPDATE agents SET deleted_at = 1 WHERE id = 'c1'", [])
            .unwrap();

        let stored = children_of_parent(&conn, "container").unwrap();

        assert_eq!(
            stored.iter().map(|row| row.id.as_str()).collect::<Vec<_>>(),
            vec!["c2"]
        );
    }

    #[test]
    fn agent_insert_batch_refans_out_once_every_child_is_tombstoned() {
        let mut conn = agents_table_conn();
        insert_agent_batch(
            &mut conn,
            "container",
            vec![child_input("c1", 0), child_input("c2", 1)],
        )
        .unwrap();
        conn.execute(
            "UPDATE agents SET deleted_at = 1 WHERE parent_agent_id = 'container'",
            [],
        )
        .unwrap();

        let outcome =
            insert_agent_batch(&mut conn, "container", vec![child_input("c3", 2)]).unwrap();

        assert!(outcome.inserted);
        assert_eq!(
            outcome
                .agents
                .iter()
                .map(|row| row.id.as_str())
                .collect::<Vec<_>>(),
            vec!["c3"]
        );
    }

    fn generation_conn() -> rusqlite::Connection {
        let conn = agents_table_conn();
        conn.execute_batch(
            "CREATE TABLE agent_generation_ledger (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                workflow_run_id TEXT,
                parent_agent_id TEXT,
                causal_root_agent_id TEXT NOT NULL,
                agent_id TEXT,
                depth INTEGER NOT NULL,
                creation_path TEXT NOT NULL,
                obligation_id TEXT,
                purpose TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE generation_refusals (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                workflow_run_id TEXT,
                parent_agent_id TEXT,
                scope_key TEXT NOT NULL,
                causal_root_agent_id TEXT,
                obligation_id TEXT,
                limit_name TEXT NOT NULL,
                reason TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE (session_id, scope_key, limit_name)
            );
            CREATE TABLE evidence_inventories (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                workflow_run_id TEXT,
                agent_id TEXT NOT NULL,
                revision TEXT NOT NULL,
                entries_json TEXT NOT NULL,
                omitted_count INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE (agent_id, revision)
            );
            CREATE TABLE evidence_delivery_receipts (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                source_turn_id TEXT NOT NULL,
                inventory_revision TEXT NOT NULL,
                source_id TEXT NOT NULL,
                requested_range TEXT,
                outcome TEXT NOT NULL,
                delivered_chars INTEGER NOT NULL,
                reason TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE (agent_id, source_turn_id, source_id)
            );",
        )
        .unwrap();
        conn
    }

    fn seed_agent(conn: &rusqlite::Connection, id: &str, parent: Option<&str>, session: &str) {
        conn.execute(
            "INSERT INTO agents (id, session_id, ordinal, name, status, parent_agent_id) VALUES (?1, ?2, 0, ?1, 'running', ?3)",
            rusqlite::params![id, session, parent],
        )
        .unwrap();
    }

    fn reservation_input(reservation_id: &str, parent: Option<&str>) -> GenerationReservationInput {
        GenerationReservationInput {
            reservation_id: reservation_id.to_string(),
            session_id: "session".to_string(),
            workflow_run_id: None,
            parent_agent_id: parent.map(|value| value.to_string()),
            creation_path: "capability".to_string(),
            count: 1,
            obligation_id: None,
            purpose: None,
        }
    }

    fn generate(conn: &mut rusqlite::Connection, parent: &str, child: &str) -> GenerationReservationOutcome {
        let outcome =
            reserve_agent_generation(conn, reservation_input(&format!("reservation:{child}"), Some(parent)))
                .unwrap();
        if outcome.kind == "granted" {
            insert_bound_agent(conn, child, Some(parent), &outcome.reservations[0].reservation_id)
                .unwrap();
        }
        outcome
    }

    fn insert_bound_agent(
        conn: &mut rusqlite::Connection,
        id: &str,
        parent: Option<&str>,
        reservation_id: &str,
    ) -> Result<SessionRow, PhaseError> {
        insert_agent(
            conn,
            PhaseRunInsertInput {
                session_id: "session".to_string(),
                parent_agent_id: parent.map(|value| value.to_string()),
                workflow_run_id: None,
                routing_decision: None,
                task_profile: None,
                generation_reservation_id: Some(reservation_id.to_string()),
                ..child_input(id, 0)
            },
        )
    }

    #[test]
    fn generation_allows_depth_three_and_refuses_depth_four() {
        let mut conn = generation_conn();
        seed_agent(&conn, "root", None, "session");

        assert_eq!(generate(&mut conn, "root", "g1").reservations[0].depth, 1);
        assert_eq!(generate(&mut conn, "g1", "g2").reservations[0].depth, 2);
        assert_eq!(generate(&mut conn, "g2", "g3").reservations[0].depth, 3);
        let fourth = generate(&mut conn, "g3", "g4");

        assert_eq!(fourth.kind, "refused");
        assert_eq!(fourth.limit.as_deref(), Some("depth"));
    }

    #[test]
    fn generation_refuses_the_twenty_first_descendant_and_notifies_once() {
        let mut conn = generation_conn();
        seed_agent(&conn, "root", None, "session");
        for index in 0..20 {
            assert_eq!(generate(&mut conn, "root", &format!("child-{index}")).kind, "granted");
        }

        let overflow =
            reserve_agent_generation(&mut conn, reservation_input("reservation:overflow", Some("root")))
                .unwrap();
        let again =
            reserve_agent_generation(&mut conn, reservation_input("reservation:again", Some("root")))
                .unwrap();

        assert_eq!(overflow.limit.as_deref(), Some("root-descendants"));
        assert!(overflow.is_first_refusal);
        assert!(!again.is_first_refusal);
        let refusals: i64 = conn
            .query_row("SELECT COUNT(*) FROM generation_refusals", [], |row| row.get(0))
            .unwrap();
        assert_eq!(refusals, 1);
    }

    #[test]
    fn generation_survives_deletion_without_refunding() {
        let mut conn = generation_conn();
        seed_agent(&conn, "root", None, "session");
        for index in 0..20 {
            generate(&mut conn, "root", &format!("child-{index}"));
        }
        conn.execute("DELETE FROM agents WHERE id LIKE 'child-%'", []).unwrap();

        let after =
            reserve_agent_generation(&mut conn, reservation_input("reservation:after", Some("root")))
                .unwrap();

        assert_eq!(after.kind, "refused");
    }

    #[test]
    fn generation_rejects_cycles_missing_ancestors_and_foreign_sessions() {
        let mut conn = generation_conn();
        seed_agent(&conn, "loop-a", Some("loop-b"), "session");
        seed_agent(&conn, "loop-b", Some("loop-a"), "session");
        seed_agent(&conn, "foreign", None, "other-session");

        let cycle =
            reserve_agent_generation(&mut conn, reservation_input("reservation:cycle", Some("loop-a")))
                .unwrap();
        let missing =
            reserve_agent_generation(&mut conn, reservation_input("reservation:missing", Some("ghost")))
                .unwrap();
        let foreign =
            reserve_agent_generation(&mut conn, reservation_input("reservation:foreign", Some("foreign")))
                .unwrap();

        assert_eq!(cycle.limit.as_deref(), Some("lineage"));
        assert!(missing.reason.unwrap().contains("not on record"));
        assert!(foreign.reason.unwrap().contains("another session"));
    }

    #[test]
    fn generation_gives_every_attempt_its_own_reservation() {
        let mut conn = generation_conn();
        seed_agent(&conn, "root", None, "session");

        let first =
            reserve_agent_generation(&mut conn, reservation_input("reservation:same", Some("root")))
                .unwrap();
        let retry =
            reserve_agent_generation(&mut conn, reservation_input("reservation:same", Some("root")))
                .unwrap();

        assert_eq!(first.kind, "granted");
        assert_eq!(retry.kind, "granted");
        assert_ne!(
            first.reservations[0].reservation_id,
            retry.reservations[0].reservation_id
        );
        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM agent_generation_ledger", [], |row| row.get(0))
            .unwrap();
        assert_eq!(rows, 2);
    }

    #[test]
    fn generation_refunds_nothing_when_a_deleted_child_is_retried() {
        let mut conn = generation_conn();
        seed_agent(&conn, "root", None, "session");
        for index in 0..GENERATION_ROOT_DESCENDANT_CAP {
            assert_eq!(generate(&mut conn, "root", &format!("child-{index}")).kind, "granted");
        }
        conn.execute("DELETE FROM agents WHERE id = 'child-0'", []).unwrap();

        let retry = generate(&mut conn, "root", "child-0");

        assert_eq!(retry.kind, "refused");
        assert_eq!(retry.limit.as_deref(), Some("root-descendants"));
    }

    #[test]
    fn agent_insert_binds_a_reservation_once_and_rolls_back_otherwise() {
        let mut conn = generation_conn();
        seed_agent(&conn, "root", None, "session");
        let granted =
            reserve_agent_generation(&mut conn, reservation_input("reservation:once", Some("root")))
                .unwrap();
        let reservation_id = granted.reservations[0].reservation_id.clone();

        assert!(insert_bound_agent(&mut conn, "first", Some("root"), &reservation_id).is_ok());
        assert!(insert_bound_agent(&mut conn, "second", Some("root"), &reservation_id).is_err());
        assert!(insert_bound_agent(&mut conn, "third", Some("root"), "reservation:ghost:0").is_err());

        let bound: String = conn
            .query_row(
                "SELECT agent_id FROM agent_generation_ledger WHERE id = ?1",
                rusqlite::params![reservation_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(bound, "first");
        let orphans: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM agents WHERE id IN ('second', 'third')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(orphans, 0);
    }

    #[test]
    fn generation_counts_depth_from_lineage_when_the_parent_has_no_ledger_row() {
        let mut conn = generation_conn();
        seed_agent(&conn, "root", None, "session");
        seed_agent(&conn, "legacy-1", Some("root"), "session");
        seed_agent(&conn, "legacy-2", Some("legacy-1"), "session");
        seed_agent(&conn, "legacy-3", Some("legacy-2"), "session");

        let deep =
            reserve_agent_generation(&mut conn, reservation_input("reservation:deep", Some("legacy-3")))
                .unwrap();

        assert_eq!(deep.kind, "refused");
        assert_eq!(deep.limit.as_deref(), Some("depth"));
    }

    #[test]
    fn generation_notifies_a_root_refusal_once_per_session_and_run() {
        let mut conn = generation_conn();
        for (session, run) in [("session-a", "run-a"), ("session-b", "run-b")] {
            for index in 0..GENERATION_RUN_CAP {
                conn.execute(
                    "INSERT INTO agent_generation_ledger
                       (id, session_id, workflow_run_id, parent_agent_id, causal_root_agent_id,
                        agent_id, depth, creation_path, created_at)
                     VALUES (?1, ?2, ?3, NULL, ?1, NULL, 0, 'workflow-step', 0)",
                    rusqlite::params![format!("{run}:{index}"), session, run],
                )
                .unwrap();
            }
        }
        let root_input = |reservation: &str, session: &str, run: &str| GenerationReservationInput {
            session_id: session.to_string(),
            workflow_run_id: Some(run.to_string()),
            creation_path: "workflow-step".to_string(),
            ..reservation_input(reservation, None)
        };

        let first_a =
            reserve_agent_generation(&mut conn, root_input("reservation:a1", "session-a", "run-a"))
                .unwrap();
        let again_a =
            reserve_agent_generation(&mut conn, root_input("reservation:a2", "session-a", "run-a"))
                .unwrap();
        let first_b =
            reserve_agent_generation(&mut conn, root_input("reservation:b1", "session-b", "run-b"))
                .unwrap();

        assert_eq!(first_a.limit.as_deref(), Some("run-descendants"));
        assert!(first_a.is_first_refusal);
        assert!(!again_a.is_first_refusal);
        assert!(first_b.is_first_refusal);
    }

    #[test]
    fn evidence_delivery_records_one_receipt_per_source_and_turn() {
        let conn = generation_conn();
        record_evidence_inventory(
            &conn,
            EvidenceInventoryInput {
                session_id: "session".to_string(),
                workflow_run_id: None,
                agent_id: "agent-1".to_string(),
                revision: "r1".to_string(),
                entries_json: "[]".to_string(),
                omitted_count: 0,
            },
        )
        .unwrap();

        let entry = || EvidenceDeliveryEntry {
            source_id: "task:agent-1".to_string(),
            requested_range: None,
            outcome: "delivered".to_string(),
            delivered_chars: 12,
            reason: String::new(),
        };
        record_evidence_delivery(
            &conn,
            EvidenceDeliveryInput {
                session_id: "session".to_string(),
                agent_id: "agent-1".to_string(),
                source_turn_id: "turn-1".to_string(),
                inventory_revision: "r1".to_string(),
                receipts: vec![entry()],
            },
        )
        .unwrap();
        let receipts = record_evidence_delivery(
            &conn,
            EvidenceDeliveryInput {
                session_id: "session".to_string(),
                agent_id: "agent-1".to_string(),
                source_turn_id: "turn-1".to_string(),
                inventory_revision: "r1".to_string(),
                receipts: vec![entry()],
            },
        )
        .unwrap();

        assert_eq!(receipts.len(), 1);
        assert_eq!(receipts[0].delivered_chars, 12);
    }

}
