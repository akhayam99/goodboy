use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionRuleRow {
    pub id: String,
    pub scope: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    #[serde(rename = "patternTool")]
    pub pattern_tool: String,
    #[serde(rename = "patternArgsMatcher")]
    pub pattern_args_matcher: Option<String>,
    pub decision: String,
    pub priority: i64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PermissionRuleUpsertInput {
    pub id: Option<String>,
    pub scope: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    #[serde(rename = "patternTool")]
    pub pattern_tool: String,
    #[serde(rename = "patternArgsMatcher")]
    pub pattern_args_matcher: Option<String>,
    pub decision: String,
    pub priority: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionAuditRow {
    pub id: String,
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "toolUseId")]
    pub tool_use_id: String,
    #[serde(rename = "toolName")]
    pub tool_name: String,
    #[serde(rename = "inputJson")]
    pub input_json: String,
    pub decision: String,
    #[serde(rename = "ruleId")]
    pub rule_id: Option<String>,
    #[serde(rename = "decidedBy")]
    pub decided_by: String,
    #[serde(rename = "requestedAt")]
    pub requested_at: String,
    #[serde(rename = "decidedAt")]
    pub decided_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PermissionAuditInsertInput {
    pub id: Option<String>,
    #[serde(rename = "runId")]
    pub run_id: String,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    #[serde(rename = "toolUseId")]
    pub tool_use_id: String,
    #[serde(rename = "toolName")]
    pub tool_name: String,
    #[serde(rename = "inputJson")]
    pub input_json: String,
    pub decision: String,
    #[serde(rename = "ruleId")]
    pub rule_id: Option<String>,
    #[serde(rename = "decidedBy")]
    pub decided_by: String,
    #[serde(rename = "requestedAt")]
    pub requested_at: String,
    #[serde(rename = "decidedAt")]
    pub decided_at: String,
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum PermissionError {
    #[error("db error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("db mutex poisoned")]
    Poisoned,
    #[error("invalid scope: {0}")]
    InvalidScope(String),
}

impl Serialize for PermissionError {
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

impl PermissionError {
    fn kind(&self) -> &'static str {
        match self {
            PermissionError::Db(_) => "db",
            PermissionError::Poisoned => "poisoned",
            PermissionError::InvalidScope(_) => "invalid_scope",
        }
    }
}

impl From<DbError> for PermissionError {
    fn from(e: DbError) -> Self {
        match e {
            DbError::Sqlite(inner) => PermissionError::Db(inner),
            DbError::Poisoned => PermissionError::Poisoned,
            _ => PermissionError::Db(rusqlite::Error::InvalidQuery),
        }
    }
}

// ---------------------------------------------------------------------------
// Commands — permission rules
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn permission_rule_list(
    state: State<'_, Db>,
    scope: String,
    workspace_id: Option<String>,
    session_id: Option<String>,
) -> Result<Vec<PermissionRuleRow>, PermissionError> {
    let conn = state.0.lock().map_err(|_| PermissionError::Poisoned)?;

    let (sql, params): (&str, Vec<Option<String>>) = match scope.as_str() {
        "global" => (
            "SELECT id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
                    decision, priority, created_at, updated_at
             FROM permission_rules
             WHERE scope = 'global'
             ORDER BY priority DESC, updated_at DESC",
            vec![],
        ),
        "workspace" => (
            "SELECT id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
                    decision, priority, created_at, updated_at
             FROM permission_rules
             WHERE scope = 'workspace' AND workspace_id = ?1
             ORDER BY priority DESC, updated_at DESC",
            vec![workspace_id],
        ),
        "session" => (
            "SELECT id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
                    decision, priority, created_at, updated_at
             FROM permission_rules
             WHERE scope = 'session' AND session_id = ?1
             ORDER BY priority DESC, updated_at DESC",
            vec![session_id],
        ),
        _ => {
            return Err(PermissionError::InvalidScope(format!(
                "unknown scope: {scope}"
            )))
        }
    };

    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        Ok(PermissionRuleRow {
            id: row.get(0)?,
            scope: row.get(1)?,
            workspace_id: row.get(2)?,
            session_id: row.get(3)?,
            pattern_tool: row.get(4)?,
            pattern_args_matcher: row.get(5)?,
            decision: row.get(6)?,
            priority: row.get(7)?,
            created_at: crate::util::ms_to_iso(row.get(8)?),
            updated_at: crate::util::ms_to_iso(row.get(9)?),
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(PermissionError::Db)
}

#[tauri::command]
pub async fn permission_rule_upsert(
    state: State<'_, Db>,
    input: PermissionRuleUpsertInput,
) -> Result<PermissionRuleRow, PermissionError> {
    // Validate scope/ids combinations.
    match input.scope.as_str() {
        "global" => {
            if input.workspace_id.is_some() || input.session_id.is_some() {
                return Err(PermissionError::InvalidScope(
                    "scope=global must not have workspaceId or sessionId".to_string(),
                ));
            }
        }
        "workspace" => {
            if input.workspace_id.is_none() {
                return Err(PermissionError::InvalidScope(
                    "scope=workspace requires workspaceId".to_string(),
                ));
            }
            if input.session_id.is_some() {
                return Err(PermissionError::InvalidScope(
                    "scope=workspace must not have sessionId".to_string(),
                ));
            }
        }
        "session" => {
            if input.session_id.is_none() {
                return Err(PermissionError::InvalidScope(
                    "scope=session requires sessionId".to_string(),
                ));
            }
        }
        other => {
            return Err(PermissionError::InvalidScope(format!(
                "unknown scope: {other}"
            )))
        }
    }

    let conn = state.0.lock().map_err(|_| PermissionError::Poisoned)?;
    let now_ms = crate::util::now_ms();
    let now = crate::util::ms_to_iso(now_ms);
    let id = input.id.clone().unwrap_or_else(crate::util::uuid_v4);

    let created_at_ms: i64 = {
        let mut stmt =
            conn.prepare("SELECT created_at FROM permission_rules WHERE id = ?1 LIMIT 1")?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| row.get(0))?;
        match rows.next() {
            Some(r) => r.map_err(PermissionError::Db)?,
            None => now_ms,
        }
    };

    conn.execute(
        "INSERT INTO permission_rules
           (id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
            decision, priority, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
           scope               = excluded.scope,
           workspace_id        = excluded.workspace_id,
           session_id          = excluded.session_id,
           pattern_tool        = excluded.pattern_tool,
           pattern_args_matcher = excluded.pattern_args_matcher,
           decision            = excluded.decision,
           priority            = excluded.priority,
           updated_at          = excluded.updated_at",
        rusqlite::params![
            id,
            input.scope,
            input.workspace_id,
            input.session_id,
            input.pattern_tool,
            input.pattern_args_matcher,
            input.decision,
            input.priority,
            created_at_ms,
            now_ms,
        ],
    )?;

    Ok(PermissionRuleRow {
        id,
        scope: input.scope,
        workspace_id: input.workspace_id,
        session_id: input.session_id,
        pattern_tool: input.pattern_tool,
        pattern_args_matcher: input.pattern_args_matcher,
        decision: input.decision,
        priority: input.priority,
        created_at: crate::util::ms_to_iso(created_at_ms),
        updated_at: now,
    })
}

// ---------------------------------------------------------------------------
// Commands — permission audit log
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn permission_audit_insert(
    state: State<'_, Db>,
    input: PermissionAuditInsertInput,
) -> Result<PermissionAuditRow, PermissionError> {
    let conn = state.0.lock().map_err(|_| PermissionError::Poisoned)?;
    let id = input.id.clone().unwrap_or_else(crate::util::uuid_v4);

    conn.execute(
        "INSERT INTO permission_audit_log
           (id, run_id, session_id, tool_use_id, tool_name, input_json,
            decision, rule_id, decided_by, requested_at, decided_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            id,
            input.run_id,
            input.session_id,
            input.tool_use_id,
            input.tool_name,
            input.input_json,
            input.decision,
            input.rule_id,
            input.decided_by,
            crate::util::iso_to_ms(&input.requested_at).unwrap_or_else(crate::util::now_ms),
            crate::util::iso_to_ms(&input.decided_at).unwrap_or_else(crate::util::now_ms),
        ],
    )?;

    Ok(PermissionAuditRow {
        id,
        run_id: input.run_id,
        session_id: input.session_id,
        tool_use_id: input.tool_use_id,
        tool_name: input.tool_name,
        input_json: input.input_json,
        decision: input.decision,
        rule_id: input.rule_id,
        decided_by: input.decided_by,
        requested_at: input.requested_at,
        decided_at: input.decided_at,
    })
}

// ---------------------------------------------------------------------------
// Commands — permission audit retry queue (#196)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct AuditRetryRow {
    pub id: String,
    #[serde(rename = "payloadJson")]
    pub payload_json: String,
    pub attempts: i64,
    #[serde(rename = "lastError")]
    pub last_error: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct AuditRetryEnqueueInput {
    pub id: String,
    #[serde(rename = "payloadJson")]
    pub payload_json: String,
}

#[tauri::command]
pub async fn permission_audit_retry_enqueue(
    state: State<'_, Db>,
    input: AuditRetryEnqueueInput,
) -> Result<(), PermissionError> {
    let conn = state.0.lock().map_err(|_| PermissionError::Poisoned)?;
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    conn.execute(
        "INSERT INTO permission_audit_retry (id, payload_json, attempts, last_error, created_at, updated_at)
         VALUES (?1, ?2, 0, NULL, ?3, ?4)
         ON CONFLICT(id) DO NOTHING",
        rusqlite::params![input.id, input.payload_json, now_ms, now_ms],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn permission_audit_retry_drain(
    state: State<'_, Db>,
    limit: i64,
) -> Result<Vec<AuditRetryRow>, PermissionError> {
    let conn = state.0.lock().map_err(|_| PermissionError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT id, payload_json, attempts, last_error, created_at, updated_at
         FROM permission_audit_retry
         ORDER BY created_at ASC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map(rusqlite::params![limit], |row| {
        Ok(AuditRetryRow {
            id: row.get(0)?,
            payload_json: row.get(1)?,
            attempts: row.get(2)?,
            last_error: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(PermissionError::Db)
}

#[tauri::command]
pub async fn permission_audit_retry_update(
    state: State<'_, Db>,
    id: String,
    attempts: i64,
    last_error: String,
) -> Result<(), PermissionError> {
    let conn = state.0.lock().map_err(|_| PermissionError::Poisoned)?;
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    conn.execute(
        "UPDATE permission_audit_retry SET attempts = ?1, last_error = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![attempts, last_error, now_ms, id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn permission_audit_retry_delete(
    state: State<'_, Db>,
    id: String,
) -> Result<(), PermissionError> {
    let conn = state.0.lock().map_err(|_| PermissionError::Poisoned)?;
    conn.execute(
        "DELETE FROM permission_audit_retry WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}
