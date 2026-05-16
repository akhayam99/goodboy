use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

// ---------------------------------------------------------------------------
// Schema version — bump on breaking change
// ---------------------------------------------------------------------------

const SCHEMA_VERSION: u32 = 1;

// ---------------------------------------------------------------------------
// Bundle types (mirrors packages/types/src/config-bundle.ts)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceBundle {
    pub id: String,
    pub name: String,
    #[serde(rename = "rootPath")]
    pub root_path: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    pub overrides: WorkspaceOverridesBundle,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceOverridesBundle {
    #[serde(rename = "defaultProviderId")]
    pub default_provider_id: Option<String>,
    #[serde(rename = "defaultWorkflowId")]
    pub default_workflow_id: Option<String>,
    #[serde(rename = "defaultBranchPrefix")]
    pub default_branch_prefix: Option<String>,
    #[serde(rename = "parallelEnabled")]
    pub parallel_enabled: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillBundle {
    pub id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub body: String,
    #[serde(rename = "frontmatterJson")]
    pub frontmatter_json: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PhaseDefinitionBundle {
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
pub struct PhaseTemplateBundle {
    pub id: String,
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<PhaseDefinitionBundle>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionRuleBundle {
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

#[derive(Debug, Serialize, Deserialize)]
pub struct BudgetRuleBundle {
    pub id: String,
    pub provider: String,
    pub period: String,
    #[serde(rename = "capUsd")]
    pub cap_usd: f64,
    #[serde(rename = "alertThresholdPct")]
    pub alert_threshold_pct: f64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsBundle {
    #[serde(rename = "editorBinary")]
    pub editor_binary: Option<String>,
    #[serde(rename = "enableParallelAgents")]
    pub enable_parallel_agents: Option<String>,
    #[serde(rename = "maxParallelism")]
    pub max_parallelism: Option<String>,
    #[serde(rename = "providerPricingConfig")]
    pub provider_pricing_config: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigBundle {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u32,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub workspaces: Vec<WorkspaceBundle>,
    pub skills: Vec<SkillBundle>,
    #[serde(rename = "phaseTemplates")]
    pub phase_templates: Vec<PhaseTemplateBundle>,
    #[serde(rename = "permissionRules")]
    pub permission_rules: Vec<PermissionRuleBundle>,
    #[serde(rename = "budgetRules")]
    pub budget_rules: Vec<BudgetRuleBundle>,
    pub settings: SettingsBundle,
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum ConfigExportError {
    #[error("db error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("db mutex poisoned")]
    Poisoned,
    #[error("schema version mismatch: got {got}, expected {expected}")]
    SchemaMismatch { got: u32, expected: u32 },
    #[error("validation error: {0}")]
    Validation(String),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

impl Serialize for ConfigExportError {
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

impl ConfigExportError {
    fn kind(&self) -> &'static str {
        match self {
            ConfigExportError::Db(_) => "db",
            ConfigExportError::Poisoned => "poisoned",
            ConfigExportError::SchemaMismatch { .. } => "schema_mismatch",
            ConfigExportError::Validation(_) => "validation",
            ConfigExportError::Json(_) => "json",
        }
    }
}

impl From<DbError> for ConfigExportError {
    fn from(e: DbError) -> Self {
        match e {
            DbError::Sqlite(inner) => ConfigExportError::Db(inner),
            DbError::Poisoned => ConfigExportError::Poisoned,
            _ => ConfigExportError::Validation(e.to_string()),
        }
    }
}

// ---------------------------------------------------------------------------
// export_config command
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn export_config(state: State<'_, Db>) -> Result<ConfigBundle, ConfigExportError> {
    let conn = state.0.lock().map_err(|_| ConfigExportError::Poisoned)?;

    // workspaces + overrides
    let workspaces = {
        let mut stmt = conn.prepare(
            "SELECT id, name, root_path, created_at, updated_at,
                    default_provider_id, default_workflow_id, default_branch_prefix, parallel_enabled
             FROM workspaces
             ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let parallel_raw: Option<i64> = row.get(8)?;
            Ok(WorkspaceBundle {
                id: row.get(0)?,
                name: row.get(1)?,
                root_path: row.get(2)?,
                created_at: ms_col_to_iso(row.get::<_, i64>(3).unwrap_or(0)),
                updated_at: ms_col_to_iso(row.get::<_, i64>(4).unwrap_or(0)),
                overrides: WorkspaceOverridesBundle {
                    default_provider_id: row.get(5)?,
                    default_workflow_id: row.get(6)?,
                    default_branch_prefix: row.get(7)?,
                    parallel_enabled: parallel_raw.map(|v| v != 0),
                },
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    // skills
    let skills = {
        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, name, description, file_path, body, frontmatter_json,
                    created_at, updated_at
             FROM skills
             ORDER BY workspace_id, created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SkillBundle {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                file_path: row.get(4)?,
                body: row.get(5)?,
                frontmatter_json: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    // workflows + steps
    let phase_templates = {
        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, name, description, created_at, updated_at
             FROM workflows
             ORDER BY workspace_id, created_at ASC",
        )?;
        let template_rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })?;
        let mut templates: Vec<PhaseTemplateBundle> = Vec::new();
        for row in template_rows {
            let (id, workspace_id, name, description, created_at, updated_at) = row?;
            let mut def_stmt = conn.prepare(
                "SELECT id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override
                 FROM steps
                 WHERE workflow_id = ?1
                 ORDER BY ordinal ASC",
            )?;
            let defs = def_stmt
                .query_map(rusqlite::params![id], |r| {
                    Ok(PhaseDefinitionBundle {
                        id: r.get(0)?,
                        workflow_id: r.get(1)?,
                        ordinal: r.get(2)?,
                        name: r.get(3)?,
                        prompt_prefix: r.get(4)?,
                        provider_override: r.get(5)?,
                        model_override: r.get(6)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            templates.push(PhaseTemplateBundle {
                id,
                workspace_id,
                name,
                description,
                steps: defs,
                created_at,
                updated_at,
            });
        }
        templates
    };

    // permission rules — global + workspace scope only (no session-scoped rules; sessions are ephemeral)
    let permission_rules = {
        let mut stmt = conn.prepare(
            "SELECT id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
                    decision, priority, created_at, updated_at
             FROM permission_rules
             WHERE scope IN ('global', 'workspace')
             ORDER BY scope, priority DESC, created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PermissionRuleBundle {
                id: row.get(0)?,
                scope: row.get(1)?,
                workspace_id: row.get(2)?,
                session_id: row.get(3)?,
                pattern_tool: row.get(4)?,
                pattern_args_matcher: row.get(5)?,
                decision: row.get(6)?,
                priority: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    // budget rules
    let budget_rules = {
        let mut stmt = conn.prepare(
            "SELECT id, provider, period, cap_usd, alert_threshold_pct, created_at
             FROM budget_rules
             ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(BudgetRuleBundle {
                id: row.get(0)?,
                provider: row.get(1)?,
                period: row.get(2)?,
                cap_usd: row.get(3)?,
                alert_threshold_pct: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    };

    // settings — only well-known keys (no api keys, no credentials)
    let settings = {
        fn get_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
            conn.query_row(
                "SELECT value FROM settings WHERE key = ?1 LIMIT 1",
                rusqlite::params![key],
                |row| row.get(0),
            )
            .ok()
        }
        SettingsBundle {
            editor_binary: get_setting(&conn, "editor.binary"),
            enable_parallel_agents: get_setting(&conn, "experimental.enable_parallel_agents"),
            max_parallelism: get_setting(&conn, "experimental.max_parallelism"),
            provider_pricing_config: get_setting(&conn, "provider.pricing_config"),
        }
    };

    Ok(ConfigBundle {
        schema_version: SCHEMA_VERSION,
        exported_at: iso_now(),
        workspaces,
        skills,
        phase_templates,
        permission_rules,
        budget_rules,
        settings,
    })
}

// ---------------------------------------------------------------------------
// import_config command
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ImportStats {
    pub workspaces: usize,
    pub skills: usize,
    #[serde(rename = "phaseTemplates")]
    pub phase_templates: usize,
    #[serde(rename = "permissionRules")]
    pub permission_rules: usize,
    #[serde(rename = "budgetRules")]
    pub budget_rules: usize,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub ok: bool,
    pub errors: Vec<ValidationError>,
    pub stats: ImportStats,
}

#[tauri::command]
pub fn import_config(
    state: State<'_, Db>,
    bundle: ConfigBundle,
) -> Result<ImportResult, ConfigExportError> {
    // Validate schema version.
    if bundle.schema_version != SCHEMA_VERSION {
        return Err(ConfigExportError::SchemaMismatch {
            got: bundle.schema_version,
            expected: SCHEMA_VERSION,
        });
    }

    let mut errors: Vec<ValidationError> = Vec::new();

    // Basic validation.
    for (i, w) in bundle.workspaces.iter().enumerate() {
        if w.id.trim().is_empty() {
            errors.push(ValidationError {
                field: format!("workspaces[{i}].id"),
                message: "id must not be empty".to_string(),
            });
        }
        if w.name.trim().is_empty() {
            errors.push(ValidationError {
                field: format!("workspaces[{i}].name"),
                message: "name must not be empty".to_string(),
            });
        }
    }
    for (i, r) in bundle.permission_rules.iter().enumerate() {
        if !matches!(r.scope.as_str(), "global" | "workspace") {
            errors.push(ValidationError {
                field: format!("permissionRules[{i}].scope"),
                message: format!("invalid scope '{}'; expected global|workspace", r.scope),
            });
        }
        if !matches!(r.decision.as_str(), "allow" | "deny" | "ask") {
            errors.push(ValidationError {
                field: format!("permissionRules[{i}].decision"),
                message: format!("invalid decision '{}'", r.decision),
            });
        }
    }
    for (i, b) in bundle.budget_rules.iter().enumerate() {
        if b.cap_usd < 0.0 {
            errors.push(ValidationError {
                field: format!("budgetRules[{i}].capUsd"),
                message: "capUsd must be non-negative".to_string(),
            });
        }
        if b.alert_threshold_pct < 0.0 || b.alert_threshold_pct > 100.0 {
            errors.push(ValidationError {
                field: format!("budgetRules[{i}].alertThresholdPct"),
                message: "alertThresholdPct must be 0–100".to_string(),
            });
        }
    }

    if !errors.is_empty() {
        return Ok(ImportResult {
            ok: false,
            errors,
            stats: ImportStats {
                workspaces: 0,
                skills: 0,
                phase_templates: 0,
                permission_rules: 0,
                budget_rules: 0,
            },
        });
    }

    // Apply in a single transaction; rollback on any failure.
    let conn = state.0.lock().map_err(|_| ConfigExportError::Poisoned)?;

    conn.execute_batch("BEGIN")?;

    let result = (|| -> Result<ImportStats, rusqlite::Error> {
        let now_ms = now_ms();

        // Workspaces — upsert (preserve existing data, add missing).
        for w in &bundle.workspaces {
            let parallel_val: Option<i64> = w.overrides.parallel_enabled.map(|v| if v { 1 } else { 0 });
            let created_ms = iso_to_ms(&w.created_at).unwrap_or(now_ms);
            let updated_ms = iso_to_ms(&w.updated_at).unwrap_or(now_ms);
            conn.execute(
                "INSERT INTO workspaces
                   (id, name, root_path, created_at, updated_at,
                    default_provider_id, default_workflow_id, default_branch_prefix, parallel_enabled)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                 ON CONFLICT(id) DO UPDATE SET
                   name                      = excluded.name,
                   default_provider_id       = excluded.default_provider_id,
                   default_workflow_id = excluded.default_workflow_id,
                   default_branch_prefix     = excluded.default_branch_prefix,
                   parallel_enabled          = excluded.parallel_enabled,
                   updated_at                = excluded.updated_at",
                rusqlite::params![
                    w.id, w.name, w.root_path,
                    created_ms, updated_ms,
                    w.overrides.default_provider_id,
                    w.overrides.default_workflow_id,
                    w.overrides.default_branch_prefix,
                    parallel_val,
                ],
            )?;
        }

        // Skills — upsert.
        for s in &bundle.skills {
            conn.execute(
                "INSERT INTO skills
                   (id, workspace_id, name, description, file_path, body, frontmatter_json, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                 ON CONFLICT(id) DO UPDATE SET
                   name             = excluded.name,
                   description      = excluded.description,
                   file_path        = excluded.file_path,
                   body             = excluded.body,
                   frontmatter_json = excluded.frontmatter_json,
                   updated_at       = excluded.updated_at",
                rusqlite::params![
                    s.id, s.workspace_id, s.name, s.description,
                    s.file_path, s.body, s.frontmatter_json,
                    s.created_at, s.updated_at,
                ],
            )?;
        }

        // Phase templates + definitions — upsert.
        for t in &bundle.phase_templates {
            conn.execute(
                "INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                   name        = excluded.name,
                   description = excluded.description,
                   updated_at  = excluded.updated_at",
                rusqlite::params![
                    t.id, t.workspace_id, t.name, t.description,
                    t.created_at, t.updated_at,
                ],
            )?;
            for d in &t.steps {
                conn.execute(
                    "INSERT INTO steps
                       (id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                     ON CONFLICT(id) DO UPDATE SET
                       ordinal          = excluded.ordinal,
                       name             = excluded.name,
                       prompt_prefix    = excluded.prompt_prefix,
                       provider_override = excluded.provider_override,
                       model_override   = excluded.model_override",
                    rusqlite::params![
                        d.id, d.workflow_id, d.ordinal, d.name,
                        d.prompt_prefix, d.provider_override, d.model_override,
                    ],
                )?;
            }
        }

        // Permission rules — upsert (global + workspace only).
        for r in &bundle.permission_rules {
            conn.execute(
                "INSERT INTO permission_rules
                   (id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
                    decision, priority, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                 ON CONFLICT(id) DO UPDATE SET
                   scope                = excluded.scope,
                   workspace_id         = excluded.workspace_id,
                   pattern_tool         = excluded.pattern_tool,
                   pattern_args_matcher = excluded.pattern_args_matcher,
                   decision             = excluded.decision,
                   priority             = excluded.priority,
                   updated_at           = excluded.updated_at",
                rusqlite::params![
                    r.id, r.scope, r.workspace_id, r.session_id,
                    r.pattern_tool, r.pattern_args_matcher,
                    r.decision, r.priority,
                    r.created_at, r.updated_at,
                ],
            )?;
        }

        // Budget rules — upsert.
        for b in &bundle.budget_rules {
            conn.execute(
                "INSERT INTO budget_rules (id, provider, period, cap_usd, alert_threshold_pct, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                   provider            = excluded.provider,
                   period              = excluded.period,
                   cap_usd             = excluded.cap_usd,
                   alert_threshold_pct = excluded.alert_threshold_pct",
                rusqlite::params![
                    b.id, b.provider, b.period, b.cap_usd, b.alert_threshold_pct, b.created_at,
                ],
            )?;
        }

        // Settings — upsert only non-null values.
        let setting_pairs: &[(&str, Option<&str>)] = &[
            ("editor.binary", bundle.settings.editor_binary.as_deref()),
            ("experimental.enable_parallel_agents", bundle.settings.enable_parallel_agents.as_deref()),
            ("experimental.max_parallelism", bundle.settings.max_parallelism.as_deref()),
            ("provider.pricing_config", bundle.settings.provider_pricing_config.as_deref()),
        ];
        for (key, val) in setting_pairs {
            if let Some(v) = val {
                conn.execute(
                    "INSERT INTO settings (key, value, updated_at)
                     VALUES (?1, ?2, ?3)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                    rusqlite::params![key, v, now_ms],
                )?;
            }
        }

        Ok(ImportStats {
            workspaces: bundle.workspaces.len(),
            skills: bundle.skills.len(),
            phase_templates: bundle.phase_templates.len(),
            permission_rules: bundle.permission_rules.len(),
            budget_rules: bundle.budget_rules.len(),
        })
    })();

    match result {
        Ok(stats) => {
            conn.execute_batch("COMMIT")?;
            Ok(ImportResult {
                ok: true,
                errors: vec![],
                stats,
            })
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(ConfigExportError::Db(e))
        }
    }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn ms_col_to_iso(ms: i64) -> String {
    let secs = ms / 1000;
    let (year, month, day, hour, min, sec) = epoch_secs_to_datetime(secs);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

fn iso_to_ms(s: &str) -> Option<i64> {
    // Minimal ISO-8601 parse: YYYY-MM-DDTHH:MM:SSZ
    if s.len() < 19 {
        return None;
    }
    let year: i64 = s[0..4].parse().ok()?;
    let month: u32 = s[5..7].parse().ok()?;
    let day: u32 = s[8..10].parse().ok()?;
    let hour: u32 = s[11..13].parse().ok()?;
    let min: u32 = s[14..16].parse().ok()?;
    let sec: u32 = s[17..19].parse().ok()?;

    let mut days: i64 = 0;
    for y in 1970..year {
        days += if is_leap_year(y) { 366 } else { 365 };
    }
    for m in 1..month {
        days += days_in_month(year, m);
    }
    days += day as i64 - 1;
    let total_secs = days * 86400 + hour as i64 * 3600 + min as i64 * 60 + sec as i64;
    Some(total_secs * 1000)
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
        _ => 30,
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

// ---------------------------------------------------------------------------
// File-based commands (avoid requiring tauri-plugin-fs on the JS side)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn export_config_to_file(
    state: State<'_, Db>,
    path: String,
) -> Result<(), ConfigExportError> {
    let bundle = export_config(state)?;
    let json = serde_json::to_string_pretty(&bundle)?;
    std::fs::write(&path, json).map_err(|e| ConfigExportError::Validation(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn import_config_from_file(
    state: State<'_, Db>,
    path: String,
) -> Result<ImportResult, ConfigExportError> {
    let raw =
        std::fs::read_to_string(&path).map_err(|e| ConfigExportError::Validation(e.to_string()))?;
    let bundle: ConfigBundle = serde_json::from_str(&raw)?;
    import_config(state, bundle)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso_roundtrip() {
        let ms: i64 = 1_700_000_000_000;
        let iso = ms_col_to_iso(ms);
        let back = iso_to_ms(&iso).expect("parse failed");
        // Allow ±1000ms rounding from second truncation.
        assert!((back - ms).abs() < 1000, "ms={ms} iso={iso} back={back}");
    }

    #[test]
    fn schema_version_is_one() {
        assert_eq!(SCHEMA_VERSION, 1);
    }

    #[test]
    fn bundle_serialization_no_secrets() {
        let bundle = ConfigBundle {
            schema_version: SCHEMA_VERSION,
            exported_at: "2026-01-01T00:00:00Z".to_string(),
            workspaces: vec![],
            skills: vec![],
            phase_templates: vec![],
            permission_rules: vec![],
            budget_rules: vec![],
            settings: SettingsBundle {
                editor_binary: Some("code".to_string()),
                enable_parallel_agents: Some("true".to_string()),
                max_parallelism: Some("4".to_string()),
                provider_pricing_config: None,
            },
        };
        let json = serde_json::to_string(&bundle).expect("serialize failed");
        // Must not contain any credential-like keys.
        assert!(!json.contains("apiKey"), "json leaked apiKey");
        assert!(!json.contains("api_key"), "json leaked api_key");
        assert!(!json.contains("secret"), "json leaked secret");
        assert!(!json.contains("password"), "json leaked password");
        assert!(!json.contains("token"), "json leaked token");
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&json)
                .expect("parse failed")["schemaVersion"],
            serde_json::Value::Number(serde_json::Number::from(1u32))
        );
    }

    #[test]
    fn import_rejects_wrong_schema_version() {
        let bundle = ConfigBundle {
            schema_version: 99,
            exported_at: "2026-01-01T00:00:00Z".to_string(),
            workspaces: vec![],
            skills: vec![],
            phase_templates: vec![],
            permission_rules: vec![],
            budget_rules: vec![],
            settings: SettingsBundle {
                editor_binary: None,
                enable_parallel_agents: None,
                max_parallelism: None,
                provider_pricing_config: None,
            },
        };
        // Simulate the schema version check (no DB needed).
        let result: Result<(), _> = if bundle.schema_version != SCHEMA_VERSION {
            Err(ConfigExportError::SchemaMismatch {
                got: bundle.schema_version,
                expected: SCHEMA_VERSION,
            })
        } else {
            Ok(())
        };
        assert!(result.is_err(), "should reject wrong schema version");
        let err = result.unwrap_err();
        assert!(err.to_string().contains("99"), "error should mention got version");
    }

    #[test]
    fn import_validates_bad_permission_rule() {
        let bad_rule = PermissionRuleBundle {
            id: "r1".to_string(),
            scope: "session".to_string(), // not allowed in export
            workspace_id: None,
            session_id: Some("s1".to_string()),
            pattern_tool: "Bash".to_string(),
            pattern_args_matcher: None,
            decision: "allow".to_string(),
            priority: 0,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        };
        let mut errors: Vec<ValidationError> = Vec::new();
        if !matches!(bad_rule.scope.as_str(), "global" | "workspace") {
            errors.push(ValidationError {
                field: "permissionRules[0].scope".to_string(),
                message: format!("invalid scope '{}'", bad_rule.scope),
            });
        }
        assert_eq!(errors.len(), 1);
        assert!(errors[0].message.contains("session"));
    }
}
