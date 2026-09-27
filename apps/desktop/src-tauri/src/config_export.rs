use std::collections::{HashMap, HashSet};

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::db::{Db, DbError};
use crate::repo::{
    find_moved_projects_blocking, FindMovedProjectsArgs, MovedProjectInput, MovedProjectVerdict,
};

const SCHEMA_VERSION: u32 = 3;
const LEGACY_SCHEMA_VERSIONS: [u32; 2] = [1, 2];

fn is_supported_schema_version(version: u32) -> bool {
    version == SCHEMA_VERSION || LEGACY_SCHEMA_VERSIONS.contains(&version)
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileBundle {
    #[serde(default)]
    pub roles_json: Option<String>,
    #[serde(default)]
    pub about_work: Option<String>,
    #[serde(default)]
    pub working_rules: Option<String>,
    #[serde(default)]
    pub explain_more_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceBundle {
    pub id: String,
    pub name: String,
    #[serde(rename = "rootPath", default, skip_serializing_if = "Option::is_none")]
    pub root_path: Option<String>,
    #[serde(default)]
    pub projects: Vec<ProjectBundle>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    pub overrides: WorkspaceOverridesBundle,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile: Option<ProfileBundle>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectBundle {
    pub id: String,
    pub name: String,
    #[serde(rename = "rootPath", default, skip_serializing_if = "Option::is_none")]
    pub root_path: Option<String>,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(rename = "starredAt", default, skip_serializing_if = "Option::is_none")]
    pub starred_at: Option<String>,
    #[serde(
        rename = "baseBranch",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub base_branch: Option<String>,
    #[serde(
        rename = "rootCommit",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub root_commit: Option<String>,
    #[serde(rename = "remoteUrl", default, skip_serializing_if = "Option::is_none")]
    pub remote_url: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceOverridesBundle {
    pub default_provider_id: Option<String>,
    pub default_branch_prefix: Option<String>,
    #[serde(default)]
    pub default_verbosity: Option<String>,
    #[serde(default)]
    pub provider_bindings_json: Option<String>,
    #[serde(default)]
    pub task_models_json: Option<String>,
    #[serde(default)]
    pub role_models_json: Option<String>,
    #[serde(default)]
    pub parallel_agents: Option<bool>,
    #[serde(default)]
    pub provider_pool_json: Option<String>,
    #[serde(default)]
    pub attribution_footer: Option<bool>,
    #[serde(default)]
    pub reply_voice: Option<String>,
    #[serde(default)]
    pub reply_style_note: Option<String>,
    #[serde(default)]
    pub reply_template_fixed: Option<String>,
    #[serde(default)]
    pub reply_template_no_change: Option<String>,
    #[serde(default)]
    pub resolve_on_github: Option<bool>,
    #[serde(default)]
    pub resolve_commit_style: Option<String>,
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
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub effort: Option<String>,
    #[serde(rename = "expectedOutput", default)]
    pub expected_output: Option<String>,
    #[serde(rename = "orchestratorReason", default)]
    pub orchestrator_reason: Option<String>,
}

fn default_is_preset() -> bool {
    true
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
    #[serde(rename = "isPreset", default = "default_is_preset")]
    pub is_preset: bool,
    #[serde(default)]
    pub origin: Option<String>,
    #[serde(default)]
    pub goal: Option<String>,
    #[serde(rename = "processText", default)]
    pub process_text: Option<String>,
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
pub struct ScriptBundle {
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub body: String,
    #[serde(rename = "sortOrder", default)]
    pub sort_order: i64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolBindingBundle {
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    #[serde(rename = "projectId", default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    pub provider: String,
    #[serde(rename = "configJson")]
    pub config_json: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppPreferencesBundle {
    #[serde(rename = "editorBinary")]
    pub editor_binary: Option<String>,
    #[serde(rename = "editorDefault")]
    pub editor_default: Option<String>,
    #[serde(rename = "hiddenModelsJson")]
    pub hidden_models_json: Option<String>,
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
    #[serde(default)]
    pub scripts: Vec<ScriptBundle>,
    #[serde(rename = "toolBindings", default)]
    pub tool_bindings: Vec<ToolBindingBundle>,
    #[serde(rename = "appPreferences", default)]
    pub app_preferences: AppPreferencesBundle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportGroups {
    #[serde(default = "true_default")]
    pub workspaces: bool,
    #[serde(default = "true_default")]
    pub projects: bool,
    #[serde(default)]
    pub folder_paths: bool,
    #[serde(default = "true_default")]
    pub profile: bool,
    #[serde(default = "true_default")]
    pub workflows_yours: bool,
    #[serde(default)]
    pub workflows_orchestrated: bool,
    #[serde(default = "true_default")]
    pub scripts: bool,
    #[serde(default = "true_default")]
    pub permission_rules: bool,
    #[serde(default = "true_default")]
    pub budget_rules: bool,
    #[serde(default = "true_default")]
    pub integrations: bool,
    #[serde(default = "true_default")]
    pub app_preferences: bool,
}

fn true_default() -> bool {
    true
}

impl Default for ExportGroups {
    fn default() -> Self {
        ExportGroups {
            workspaces: true,
            projects: true,
            folder_paths: false,
            profile: true,
            workflows_yours: true,
            workflows_orchestrated: false,
            scripts: true,
            permission_rules: true,
            budget_rules: true,
            integrations: true,
            app_preferences: true,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LeftOutFinding {
    pub fingerprint: String,
    pub subject_kind: String,
    pub subject_id: String,
    pub secret_kind: String,
    pub last4: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCounts {
    pub workspaces: usize,
    pub projects: usize,
    pub skills: usize,
    pub phase_templates: usize,
    pub permission_rules: usize,
    pub budget_rules: usize,
    pub scripts: usize,
    pub tool_bindings: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreview {
    pub counts: ExportCounts,
    pub left_out_findings: Vec<LeftOutFinding>,
}

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

crate::util::impl_error_serialize!(ConfigExportError);

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

fn open_findings_for_groups(
    conn: &rusqlite::Connection,
    groups: &ExportGroups,
) -> Result<Vec<LeftOutFinding>, ConfigExportError> {
    let mut allowed_kinds: Vec<&str> = Vec::new();
    if groups.scripts {
        allowed_kinds.push("script");
    }
    if groups.workflows_yours || groups.workflows_orchestrated {
        allowed_kinds.push("workflow-step");
    }
    if groups.profile {
        allowed_kinds.push("profile");
    }
    if groups.workspaces {
        allowed_kinds.push("reply-template");
    }
    if groups.permission_rules {
        allowed_kinds.push("permission-rule");
    }
    if allowed_kinds.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = allowed_kinds
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT fingerprint, subject_kind, subject_id, secret_kind, last4
         FROM security_findings
         WHERE dismissed_at IS NULL AND resolved_at IS NULL
           AND subject_kind IN ({placeholders})
         ORDER BY first_seen_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let params = rusqlite::params_from_iter(allowed_kinds.iter());
    let rows = stmt.query_map(params, |row| {
        Ok(LeftOutFinding {
            fingerprint: row.get(0)?,
            subject_kind: row.get(1)?,
            subject_id: row.get(2)?,
            secret_kind: row.get(3)?,
            last4: row.get(4)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn build_bundle(
    conn: &rusqlite::Connection,
    groups: &ExportGroups,
    leave_out: &HashSet<String>,
) -> Result<ConfigBundle, ConfigExportError> {
    let excluded_scripts: HashSet<String> = leave_out_subject_ids(conn, "script", leave_out)?;
    let excluded_rules: HashSet<String> =
        leave_out_subject_ids(conn, "permission-rule", leave_out)?;
    let profile_excluded_workspaces: HashSet<String> =
        leave_out_subject_ids(conn, "profile", leave_out)?;

    let workspaces = if groups.workspaces {
        let mut stmt = conn.prepare(
            "SELECT id, name, created_at, updated_at,
                    default_provider_id, default_branch_prefix, default_verbosity,
                    provider_bindings, task_models, role_models, parallel_agents,
                    provider_pool, attribution_footer, reply_voice, reply_style_note,
                    reply_template_fixed, reply_template_no_change, resolve_on_github,
                    resolve_commit_style
             FROM workspaces
             WHERE deleted_at IS NULL AND disconnected_at IS NULL
             ORDER BY created_at ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(WorkspaceBundle {
                id: row.get(0)?,
                name: row.get(1)?,
                root_path: None,
                projects: Vec::new(),
                created_at: ms_col_to_iso(row.get::<_, i64>(2).unwrap_or(0)),
                updated_at: ms_col_to_iso(row.get::<_, i64>(3).unwrap_or(0)),
                overrides: WorkspaceOverridesBundle {
                    default_provider_id: row.get(4)?,
                    default_branch_prefix: row.get(5)?,
                    default_verbosity: row.get(6)?,
                    provider_bindings_json: row.get(7)?,
                    task_models_json: row.get(8)?,
                    role_models_json: row.get(9)?,
                    parallel_agents: row.get::<_, Option<i64>>(10)?.map(|v| v != 0),
                    provider_pool_json: row.get(11)?,
                    attribution_footer: row.get::<_, Option<i64>>(12)?.map(|v| v != 0),
                    reply_voice: row.get(13)?,
                    reply_style_note: row.get(14)?,
                    reply_template_fixed: row.get(15)?,
                    reply_template_no_change: row.get(16)?,
                    resolve_on_github: row.get::<_, Option<i64>>(17)?.map(|v| v != 0),
                    resolve_commit_style: row.get(18)?,
                },
                profile: None,
            })
        })?;
        let mut workspaces = rows.collect::<Result<Vec<_>, _>>()?;

        if groups.projects {
            let mut project_stmt = conn.prepare(
                "SELECT id, name, root_path, kind, created_at, updated_at,
                        description, starred_at, base_branch, root_commit, remote_url
                 FROM projects
                 WHERE workspace_id = ?1 AND disconnected_at IS NULL
                 ORDER BY created_at ASC, id ASC",
            )?;
            for workspace in &mut workspaces {
                let project_rows =
                    project_stmt.query_map(rusqlite::params![workspace.id], |row| {
                        Ok(ProjectBundle {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            root_path: if groups.folder_paths {
                                row.get(2)?
                            } else {
                                None
                            },
                            kind: row
                                .get::<_, Option<String>>(3)?
                                .unwrap_or_else(|| "repo".to_string()),
                            created_at: ms_col_to_iso(row.get::<_, i64>(4).unwrap_or(0)),
                            updated_at: ms_col_to_iso(row.get::<_, i64>(5).unwrap_or(0)),
                            description: row.get(6)?,
                            starred_at: row.get::<_, Option<i64>>(7)?.map(ms_col_to_iso),
                            base_branch: row.get(8)?,
                            root_commit: row.get(9)?,
                            remote_url: row.get(10)?,
                        })
                    })?;
                workspace.projects = project_rows.collect::<Result<Vec<_>, _>>()?;
            }
        }

        if groups.profile {
            let mut profile_stmt = conn.prepare(
                "SELECT roles_json, about_work, working_rules, explain_more_json
                 FROM workspace_profiles WHERE workspace_id = ?1",
            )?;
            for workspace in &mut workspaces {
                if profile_excluded_workspaces.contains(&workspace.id) {
                    continue;
                }
                let found = profile_stmt
                    .query_row(rusqlite::params![workspace.id], |row| {
                        Ok(ProfileBundle {
                            roles_json: row.get(0)?,
                            about_work: row.get(1)?,
                            working_rules: row.get(2)?,
                            explain_more_json: row.get(3)?,
                        })
                    })
                    .ok();
                workspace.profile = found;
            }
        }
        workspaces
    } else {
        Vec::new()
    };

    let live_workspace_ids: HashSet<String> = workspaces.iter().map(|w| w.id.clone()).collect();

    let live_project_ids: HashSet<String> = {
        let mut stmt =
            conn.prepare("SELECT id, workspace_id FROM projects WHERE disconnected_at IS NULL")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut set = HashSet::new();
        for row in rows {
            let (id, workspace_id) = row?;
            if live_workspace_ids.contains(&workspace_id) {
                set.insert(id);
            }
        }
        set
    };

    let skills = if groups.workspaces {
        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, name, description, file_path, body, frontmatter_json,
                    created_at, updated_at
             FROM skills
             WHERE workspace_id IN (
               SELECT id FROM workspaces WHERE deleted_at IS NULL AND disconnected_at IS NULL
             )
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
                created_at: ms_col_to_iso(row.get(7)?),
                updated_at: ms_col_to_iso(row.get(8)?),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|skill| live_workspace_ids.contains(&skill.workspace_id))
            .collect()
    } else {
        Vec::new()
    };

    let phase_templates = if groups.workflows_yours || groups.workflows_orchestrated {
        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, name, description, created_at, updated_at,
                    is_preset, origin, goal, process_text
             FROM workflows
             WHERE deleted_at IS NULL
               AND workspace_id IN (
                 SELECT id FROM workspaces WHERE deleted_at IS NULL AND disconnected_at IS NULL
               )
             ORDER BY workspace_id, created_at ASC",
        )?;
        let template_rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<String>>(9)?,
            ))
        })?;
        let mut templates: Vec<PhaseTemplateBundle> = Vec::new();
        for row in template_rows {
            let (
                id,
                workspace_id,
                name,
                description,
                created_at_ms,
                updated_at_ms,
                is_preset_raw,
                origin,
                goal,
                process_text,
            ) = row?;
            if !live_workspace_ids.contains(&workspace_id) {
                continue;
            }
            let is_orchestrated = origin.as_deref() == Some("orchestrated");
            if is_orchestrated && !groups.workflows_orchestrated {
                continue;
            }
            if !is_orchestrated && !groups.workflows_yours {
                continue;
            }
            let mut def_stmt = conn.prepare(
                "SELECT id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override,
                        role, effort, expected_output, orchestrator_reason
                 FROM steps
                 WHERE workflow_id = ?1 AND deleted_at IS NULL
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
                        role: r.get(7)?,
                        effort: r.get(8)?,
                        expected_output: r.get(9)?,
                        orchestrator_reason: r.get(10)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            templates.push(PhaseTemplateBundle {
                id,
                workspace_id,
                name,
                description,
                steps: defs,
                created_at: ms_col_to_iso(created_at_ms),
                updated_at: ms_col_to_iso(updated_at_ms),
                is_preset: is_preset_raw != 0,
                origin,
                goal,
                process_text,
            });
        }
        templates
    } else {
        Vec::new()
    };

    let permission_rules = if groups.permission_rules {
        let mut stmt = conn.prepare(
            "SELECT id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
                    decision, priority, created_at, updated_at
             FROM permission_rules
             WHERE scope IN ('global', 'workspace')
               AND (
                 workspace_id IS NULL
                 OR workspace_id IN (
                   SELECT id FROM workspaces WHERE deleted_at IS NULL AND disconnected_at IS NULL
                 )
               )
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
                created_at: ms_col_to_iso(row.get(8)?),
                updated_at: ms_col_to_iso(row.get(9)?),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|rule| match &rule.workspace_id {
                Some(id) => live_workspace_ids.contains(id),
                None => true,
            })
            .filter(|rule| !excluded_rules.contains(&rule.id))
            .collect()
    } else {
        Vec::new()
    };

    let budget_rules = if groups.budget_rules {
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
                created_at: ms_col_to_iso(row.get(5)?),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
    } else {
        Vec::new()
    };

    let scripts = if groups.scripts {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, body, sort_order, created_at, updated_at
             FROM project_scripts
             ORDER BY project_id, sort_order ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ScriptBundle {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                body: row.get(3)?,
                sort_order: row.get(4)?,
                created_at: ms_col_to_iso(row.get(5)?),
                updated_at: ms_col_to_iso(row.get(6)?),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|script| live_project_ids.contains(&script.project_id))
            .filter(|script| !excluded_scripts.contains(&script.id))
            .collect()
    } else {
        Vec::new()
    };

    let tool_bindings = if groups.integrations {
        let mut stmt = conn.prepare(
            "SELECT workspace_id, project_id, provider, config
             FROM integration_bindings
             WHERE workspace_id IN (
               SELECT id FROM workspaces WHERE deleted_at IS NULL AND disconnected_at IS NULL
             )
             ORDER BY workspace_id, provider",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ToolBindingBundle {
                workspace_id: row.get(0)?,
                project_id: row.get(1)?,
                provider: row.get(2)?,
                config_json: row
                    .get::<_, Option<String>>(3)?
                    .unwrap_or_else(|| "{}".to_string()),
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .filter(|binding| live_workspace_ids.contains(&binding.workspace_id))
            .collect()
    } else {
        Vec::new()
    };

    let app_preferences = if groups.app_preferences {
        fn get_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
            conn.query_row(
                "SELECT value FROM settings WHERE key = ?1 LIMIT 1",
                rusqlite::params![key],
                |row| row.get(0),
            )
            .ok()
        }
        AppPreferencesBundle {
            editor_binary: get_setting(conn, "editor.binary"),
            editor_default: get_setting(conn, "editor.default"),
            hidden_models_json: get_setting(conn, "providers.hiddenModels"),
        }
    } else {
        AppPreferencesBundle::default()
    };

    Ok(ConfigBundle {
        schema_version: SCHEMA_VERSION,
        exported_at: crate::util::iso_now(),
        workspaces,
        skills,
        phase_templates,
        permission_rules,
        budget_rules,
        scripts,
        tool_bindings,
        app_preferences,
    })
}

fn leave_out_subject_ids(
    conn: &rusqlite::Connection,
    subject_kind: &str,
    leave_out: &HashSet<String>,
) -> Result<HashSet<String>, ConfigExportError> {
    if leave_out.is_empty() {
        return Ok(HashSet::new());
    }
    let mut stmt = conn
        .prepare("SELECT subject_id, fingerprint FROM security_findings WHERE subject_kind = ?1")?;
    let rows = stmt.query_map(rusqlite::params![subject_kind], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut excluded = HashSet::new();
    for row in rows {
        let (subject_id, fingerprint) = row?;
        if leave_out.contains(&fingerprint) {
            excluded.insert(subject_id);
        }
    }
    Ok(excluded)
}

#[derive(Debug, Serialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

#[derive(Debug, Serialize, Default)]
pub struct ImportStats {
    pub workspaces: usize,
    pub skills: usize,
    #[serde(rename = "phaseTemplates")]
    pub phase_templates: usize,
    #[serde(rename = "permissionRules")]
    pub permission_rules: usize,
    #[serde(rename = "budgetRules")]
    pub budget_rules: usize,
    pub scripts: usize,
    #[serde(rename = "toolBindings")]
    pub tool_bindings: usize,
    #[serde(rename = "unresolvedProjects")]
    pub unresolved_projects: usize,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub ok: bool,
    pub errors: Vec<ValidationError>,
    pub stats: ImportStats,
}

fn validate_bundle(bundle: &ConfigBundle) -> Vec<ValidationError> {
    let mut errors: Vec<ValidationError> = Vec::new();
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
                message: "alertThresholdPct must be 0-100".to_string(),
            });
        }
    }
    errors
}

fn apply_bundle(
    conn: &rusqlite::Connection,
    mut bundle: ConfigBundle,
    workspace_targets: &HashMap<String, String>,
    resolved_project_paths: &HashMap<String, String>,
) -> Result<ImportResult, ConfigExportError> {
    if !is_supported_schema_version(bundle.schema_version) {
        return Err(ConfigExportError::SchemaMismatch {
            got: bundle.schema_version,
            expected: SCHEMA_VERSION,
        });
    }

    for workspace in &mut bundle.workspaces {
        if let Some(target) = workspace_targets.get(&workspace.id) {
            workspace.id = target.clone();
        }
    }

    let errors = validate_bundle(&bundle);
    if !errors.is_empty() {
        return Ok(ImportResult {
            ok: false,
            errors,
            stats: ImportStats::default(),
        });
    }

    conn.execute_batch("BEGIN")?;

    let result = (|| -> Result<ImportStats, rusqlite::Error> {
        let now_ms = crate::util::now_ms();
        let mut unresolved_projects = 0usize;
        let mut project_id_remap: HashMap<String, String> = HashMap::new();

        for w in &bundle.workspaces {
            let created_ms = iso_to_ms(&w.created_at).unwrap_or(now_ms);
            let updated_ms = iso_to_ms(&w.updated_at).unwrap_or(now_ms);
            conn.execute(
                "INSERT INTO workspaces
                   (id, name, slug, created_at, updated_at,
                    default_provider_id, default_branch_prefix, default_verbosity,
                    provider_bindings, task_models, role_models, parallel_agents,
                    provider_pool, attribution_footer, reply_voice, reply_style_note,
                    reply_template_fixed, reply_template_no_change, resolve_on_github,
                    resolve_commit_style)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
                 ON CONFLICT(id) DO UPDATE SET
                   name                      = excluded.name,
                   default_provider_id       = excluded.default_provider_id,
                   default_branch_prefix     = excluded.default_branch_prefix,
                   default_verbosity         = excluded.default_verbosity,
                   provider_bindings         = excluded.provider_bindings,
                   task_models               = excluded.task_models,
                   role_models               = excluded.role_models,
                   parallel_agents           = excluded.parallel_agents,
                   provider_pool             = excluded.provider_pool,
                   attribution_footer        = excluded.attribution_footer,
                   reply_voice               = excluded.reply_voice,
                   reply_style_note          = excluded.reply_style_note,
                   reply_template_fixed      = excluded.reply_template_fixed,
                   reply_template_no_change  = excluded.reply_template_no_change,
                   resolve_on_github         = excluded.resolve_on_github,
                   resolve_commit_style      = excluded.resolve_commit_style,
                   updated_at                = excluded.updated_at",
                rusqlite::params![
                    w.id,
                    w.name,
                    workspace_slug(&w.name, &w.id),
                    created_ms,
                    updated_ms,
                    w.overrides.default_provider_id,
                    w.overrides.default_branch_prefix,
                    w.overrides.default_verbosity,
                    w.overrides.provider_bindings_json,
                    w.overrides.task_models_json,
                    w.overrides.role_models_json,
                    w.overrides.parallel_agents.map(|v| if v { 1 } else { 0 }),
                    w.overrides.provider_pool_json,
                    w.overrides.attribution_footer.map(|v| if v { 1 } else { 0 }),
                    w.overrides.reply_voice,
                    w.overrides.reply_style_note,
                    w.overrides.reply_template_fixed,
                    w.overrides.reply_template_no_change,
                    w.overrides.resolve_on_github.map(|v| if v { 1 } else { 0 }),
                    w.overrides.resolve_commit_style,
                ],
            )?;

            if let Some(profile) = &w.profile {
                conn.execute(
                    "INSERT INTO workspace_profiles
                       (workspace_id, roles_json, about_work, working_rules, explain_more_json, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                     ON CONFLICT(workspace_id) DO UPDATE SET
                       roles_json = excluded.roles_json,
                       about_work = excluded.about_work,
                       working_rules = excluded.working_rules,
                       explain_more_json = excluded.explain_more_json,
                       updated_at = excluded.updated_at",
                    rusqlite::params![
                        w.id,
                        profile.roles_json,
                        profile.about_work,
                        profile.working_rules,
                        profile.explain_more_json,
                        now_ms,
                    ],
                )?;
            }

            for p in workspace_projects(w) {
                let updated_at_ms = iso_to_ms(&p.updated_at).unwrap_or(updated_ms);
                let root_path = match &p.root_path {
                    Some(path) => Some(path.clone()),
                    None => resolved_project_paths.get(&p.id).cloned(),
                };
                let Some(root_path) = root_path else {
                    unresolved_projects += 1;
                    continue;
                };
                let target_root_path = normalized_root_path(&root_path);
                let existing_id: Option<String> = {
                    let mut stmt = conn.prepare("SELECT id, root_path FROM projects")?;
                    let mut rows = stmt.query([])?;
                    let mut found = None;
                    while let Some(row) = rows.next()? {
                        let id: String = row.get(0)?;
                        let existing_root_path: String = row.get(1)?;
                        if normalized_root_path(&existing_root_path) == target_root_path {
                            found = Some(id);
                            break;
                        }
                    }
                    found
                };
                match existing_id {
                    Some(existing) if existing != p.id => {
                        conn.execute(
                            "UPDATE projects SET workspace_id = ?1, name = ?2, kind = ?3, updated_at = ?4,
                               description = ?5, starred_at = ?6, base_branch = ?7,
                               root_commit = ?8, remote_url = ?9
                             WHERE id = ?10",
                            rusqlite::params![
                                w.id, p.name, p.kind, updated_at_ms,
                                p.description, p.starred_at.as_deref().and_then(iso_to_ms),
                                p.base_branch, p.root_commit, p.remote_url,
                                existing,
                            ],
                        )?;
                        project_id_remap.insert(p.id.clone(), existing);
                    }
                    _ => {
                        conn.execute(
                            "INSERT INTO projects
                               (id, workspace_id, name, root_path, kind, created_at, updated_at,
                                description, starred_at, base_branch, root_commit, remote_url)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                             ON CONFLICT(id) DO UPDATE SET
                               name         = excluded.name,
                               root_path    = excluded.root_path,
                               kind         = excluded.kind,
                               updated_at   = excluded.updated_at,
                               description  = excluded.description,
                               starred_at   = excluded.starred_at,
                               base_branch  = excluded.base_branch,
                               root_commit  = excluded.root_commit,
                               remote_url   = excluded.remote_url",
                            rusqlite::params![
                                p.id,
                                w.id,
                                p.name,
                                root_path,
                                p.kind,
                                iso_to_ms(&p.created_at).unwrap_or(created_ms),
                                updated_at_ms,
                                p.description,
                                p.starred_at.as_deref().and_then(iso_to_ms),
                                p.base_branch,
                                p.root_commit,
                                p.remote_url,
                            ],
                        )?;
                    }
                }
            }
        }

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
                    iso_to_ms(&s.created_at).unwrap_or(now_ms),
                    iso_to_ms(&s.updated_at).unwrap_or(now_ms),
                ],
            )?;
        }

        for t in &bundle.phase_templates {
            conn.execute(
                "INSERT INTO workflows
                   (id, workspace_id, name, description, created_at, updated_at,
                    is_preset, origin, goal, process_text)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                 ON CONFLICT(id) DO UPDATE SET
                   name        = excluded.name,
                   description = excluded.description,
                   updated_at  = excluded.updated_at,
                   is_preset   = excluded.is_preset,
                   origin      = excluded.origin,
                   goal        = excluded.goal,
                   process_text = excluded.process_text",
                rusqlite::params![
                    t.id,
                    t.workspace_id,
                    t.name,
                    t.description,
                    iso_to_ms(&t.created_at).unwrap_or(now_ms),
                    iso_to_ms(&t.updated_at).unwrap_or(now_ms),
                    if t.is_preset { 1 } else { 0 },
                    t.origin,
                    t.goal,
                    t.process_text,
                ],
            )?;
            for d in &t.steps {
                conn.execute(
                    "INSERT INTO steps
                       (id, workflow_id, ordinal, name, prompt_prefix, provider_override, model_override,
                        role, effort, expected_output, orchestrator_reason)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                     ON CONFLICT(id) DO UPDATE SET
                       ordinal          = excluded.ordinal,
                       name             = excluded.name,
                       prompt_prefix    = excluded.prompt_prefix,
                       provider_override = excluded.provider_override,
                       model_override   = excluded.model_override,
                       role             = excluded.role,
                       effort           = excluded.effort,
                       expected_output  = excluded.expected_output,
                       orchestrator_reason = excluded.orchestrator_reason",
                    rusqlite::params![
                        d.id, d.workflow_id, d.ordinal, d.name,
                        d.prompt_prefix, d.provider_override, d.model_override,
                        d.role, d.effort, d.expected_output, d.orchestrator_reason,
                    ],
                )?;
            }
        }

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
                    r.id,
                    r.scope,
                    r.workspace_id,
                    r.session_id,
                    r.pattern_tool,
                    r.pattern_args_matcher,
                    r.decision,
                    r.priority,
                    iso_to_ms(&r.created_at).unwrap_or(now_ms),
                    iso_to_ms(&r.updated_at).unwrap_or(now_ms),
                ],
            )?;
        }

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
                    b.id,
                    b.provider,
                    b.period,
                    b.cap_usd,
                    b.alert_threshold_pct,
                    iso_to_ms(&b.created_at).unwrap_or(now_ms),
                ],
            )?;
        }

        for s in &bundle.scripts {
            let project_id = project_id_remap
                .get(&s.project_id)
                .cloned()
                .unwrap_or_else(|| s.project_id.clone());
            conn.execute(
                "INSERT INTO project_scripts (id, project_id, name, body, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(id) DO UPDATE SET
                   project_id = excluded.project_id,
                   name       = excluded.name,
                   body       = excluded.body,
                   sort_order = excluded.sort_order,
                   updated_at = excluded.updated_at",
                rusqlite::params![
                    s.id,
                    project_id,
                    s.name,
                    s.body,
                    s.sort_order,
                    iso_to_ms(&s.created_at).unwrap_or(now_ms),
                    iso_to_ms(&s.updated_at).unwrap_or(now_ms),
                ],
            )?;
        }

        let mut credential_counter: u64 = 0;
        for t in &bundle.tool_bindings {
            let workspace_id = workspace_targets
                .get(&t.workspace_id)
                .cloned()
                .unwrap_or_else(|| t.workspace_id.clone());
            let project_id = t.project_id.as_ref().map(|id| {
                project_id_remap
                    .get(id)
                    .cloned()
                    .unwrap_or_else(|| id.clone())
            });

            let existing_credential_id: Option<String> = conn
                .query_row(
                    "SELECT credential_id FROM integration_bindings
                     WHERE workspace_id = ?1 AND COALESCE(project_id, '') = COALESCE(?2, '') AND provider = ?3",
                    rusqlite::params![workspace_id, project_id, t.provider],
                    |row| row.get(0),
                )
                .optional()?;
            let credential_id = match existing_credential_id {
                Some(id) => id,
                None => {
                    credential_counter += 1;
                    let id = format!("integration-credential-import-{now_ms}-{credential_counter}");
                    conn.execute(
                        "INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
                         VALUES (?1, ?2, ?3, '', ?4, ?4)",
                        rusqlite::params![
                            id,
                            t.provider,
                            format!("Imported {}", t.provider),
                            now_ms,
                        ],
                    )?;
                    id
                }
            };
            conn.execute(
                "INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
                 ON CONFLICT (workspace_id, COALESCE(project_id, ''), provider) DO UPDATE SET
                   config     = excluded.config,
                   updated_at = excluded.updated_at",
                rusqlite::params![
                    format!(
                        "integration-binding:{workspace_id}:{}:{}",
                        project_id.clone().unwrap_or_default(),
                        t.provider
                    ),
                    workspace_id,
                    project_id,
                    t.provider,
                    credential_id,
                    t.config_json,
                    now_ms,
                ],
            )?;
        }

        let setting_pairs: &[(&str, Option<&str>)] = &[
            (
                "editor.binary",
                bundle.app_preferences.editor_binary.as_deref(),
            ),
            (
                "editor.default",
                bundle.app_preferences.editor_default.as_deref(),
            ),
            (
                "providers.hiddenModels",
                bundle.app_preferences.hidden_models_json.as_deref(),
            ),
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
            scripts: bundle.scripts.len(),
            tool_bindings: bundle.tool_bindings.len(),
            unresolved_projects,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportManifest {
    pub schema_version: u32,
    pub exported_at: String,
    pub workspace_count: usize,
    pub project_count: usize,
    pub workflow_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMatch {
    pub bundle_id: String,
    pub name: String,
    pub existing_id: Option<String>,
    pub action: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMatch {
    pub bundle_project_id: String,
    pub name: String,
    pub has_path: bool,
    pub resolved_path: Option<String>,
    pub verdict: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub manifest: ImportManifest,
    pub workspace_matches: Vec<WorkspaceMatch>,
    pub project_matches: Vec<ProjectMatch>,
}

fn verdict_label(verdict: &MovedProjectVerdict) -> String {
    match verdict {
        MovedProjectVerdict::SameRepository => "same_repository".to_string(),
        MovedProjectVerdict::SameNameUnconfirmed => "same_name_unconfirmed".to_string(),
        MovedProjectVerdict::DifferentRepository => "different_repository".to_string(),
        MovedProjectVerdict::NotFound => "not_found".to_string(),
    }
}

fn build_import_preview(
    conn: &rusqlite::Connection,
    bundle: &ConfigBundle,
    project_parent: Option<&str>,
) -> Result<ImportPreview, ConfigExportError> {
    let project_count: usize = bundle
        .workspaces
        .iter()
        .map(|w| workspace_projects(w).len())
        .sum();
    let manifest = ImportManifest {
        schema_version: bundle.schema_version,
        exported_at: bundle.exported_at.clone(),
        workspace_count: bundle.workspaces.len(),
        project_count,
        workflow_count: bundle.phase_templates.len(),
    };

    let mut workspace_matches = Vec::new();
    for w in &bundle.workspaces {
        let existing_by_id: Option<String> = conn
            .query_row(
                "SELECT id FROM workspaces WHERE id = ?1",
                rusqlite::params![w.id],
                |row| row.get(0),
            )
            .ok();
        let existing_by_name: Option<String> = if existing_by_id.is_some() {
            None
        } else {
            conn.query_row(
                "SELECT id FROM workspaces WHERE name = ?1 AND deleted_at IS NULL",
                rusqlite::params![w.name],
                |row| row.get(0),
            )
            .ok()
        };
        let existing_id = existing_by_id.or(existing_by_name);
        workspace_matches.push(WorkspaceMatch {
            bundle_id: w.id.clone(),
            name: w.name.clone(),
            existing_id: existing_id.clone(),
            action: if existing_id.is_some() {
                "merge".to_string()
            } else {
                "add".to_string()
            },
        });
    }

    let mut project_matches = Vec::new();
    let mut path_less_inputs: Vec<MovedProjectInput> = Vec::new();
    for w in &bundle.workspaces {
        for p in workspace_projects(w) {
            if p.root_path.is_none() {
                path_less_inputs.push(MovedProjectInput {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    root_commit: p.root_commit.clone(),
                    remote_url: p.remote_url.clone(),
                });
            }
        }
    }
    let found_matches = match project_parent {
        Some(parent) if !path_less_inputs.is_empty() => {
            find_moved_projects_blocking(FindMovedProjectsArgs {
                parent: parent.to_string(),
                projects: path_less_inputs,
            })
        }
        _ => Vec::new(),
    };
    for w in &bundle.workspaces {
        for p in workspace_projects(w) {
            if let Some(path) = &p.root_path {
                project_matches.push(ProjectMatch {
                    bundle_project_id: p.id.clone(),
                    name: p.name.clone(),
                    has_path: true,
                    resolved_path: Some(path.clone()),
                    verdict: "same_repository".to_string(),
                });
                continue;
            }
            let found = found_matches.iter().find(|m| m.project_id == p.id);
            project_matches.push(ProjectMatch {
                bundle_project_id: p.id.clone(),
                name: p.name.clone(),
                has_path: false,
                resolved_path: found.and_then(|m| m.path.clone()),
                verdict: found
                    .map(|m| verdict_label(&m.verdict))
                    .unwrap_or_else(|| "not_found".to_string()),
            });
        }
    }

    Ok(ImportPreview {
        manifest,
        workspace_matches,
        project_matches,
    })
}

fn ms_col_to_iso(ms: i64) -> String {
    crate::util::ms_to_iso(ms)
}

fn iso_to_ms(s: &str) -> Option<i64> {
    crate::util::iso_to_ms(s)
}

fn workspace_slug(name: &str, id: &str) -> String {
    let mut prefix = String::new();
    let mut pending_dash = false;
    for ch in name.to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            if pending_dash && !prefix.is_empty() {
                prefix.push('-');
            }
            pending_dash = false;
            prefix.push(ch);
        } else {
            pending_dash = true;
        }
        if prefix.len() >= 32 {
            break;
        }
    }
    let stem = if prefix.is_empty() {
        "workspace"
    } else {
        prefix.as_str()
    };
    let suffix: String = id.chars().take(8).collect();
    format!("{stem}-{suffix}")
}

fn workspace_projects(workspace: &WorkspaceBundle) -> Vec<ProjectBundle> {
    if !workspace.projects.is_empty() {
        return workspace
            .projects
            .iter()
            .map(|project| ProjectBundle {
                id: project.id.clone(),
                name: project.name.clone(),
                root_path: project.root_path.clone(),
                kind: normalized_kind(&project.kind),
                description: project.description.clone(),
                starred_at: project.starred_at.clone(),
                base_branch: project.base_branch.clone(),
                root_commit: project.root_commit.clone(),
                remote_url: project.remote_url.clone(),
                created_at: project.created_at.clone(),
                updated_at: project.updated_at.clone(),
            })
            .collect();
    }
    match &workspace.root_path {
        Some(root_path) if !root_path.trim().is_empty() => vec![ProjectBundle {
            id: format!("{}-project", workspace.id),
            name: workspace.name.clone(),
            root_path: Some(root_path.clone()),
            kind: "repo".to_string(),
            description: None,
            starred_at: None,
            base_branch: None,
            root_commit: None,
            remote_url: None,
            created_at: workspace.created_at.clone(),
            updated_at: workspace.updated_at.clone(),
        }],
        _ => Vec::new(),
    }
}

fn normalized_kind(kind: &str) -> String {
    match kind {
        "folder" => "folder".to_string(),
        _ => "repo".to_string(),
    }
}

fn normalized_root_path(path: &str) -> String {
    let mut normalized = path.to_string();
    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    normalized
}

fn write_config_file(path: &str, json: &str) -> Result<(), ConfigExportError> {
    use std::io::Write;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(path)
        .map_err(|e| ConfigExportError::Validation(e.to_string()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))
            .map_err(|e| ConfigExportError::Validation(e.to_string()))?;
    }
    file.write_all(json.as_bytes())
        .map_err(|e| ConfigExportError::Validation(e.to_string()))
}

#[tauri::command]
pub async fn config_export_preview(
    app: AppHandle,
    groups: ExportGroups,
) -> Result<ExportPreview, ConfigExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Db>();
        let conn = db.0.lock().map_err(|_| ConfigExportError::Poisoned)?;
        let left_out_findings = open_findings_for_groups(&conn, &groups)?;
        let bundle = build_bundle(&conn, &groups, &HashSet::new())?;
        Ok(ExportPreview {
            counts: ExportCounts {
                workspaces: bundle.workspaces.len(),
                projects: bundle.workspaces.iter().map(|w| w.projects.len()).sum(),
                skills: bundle.skills.len(),
                phase_templates: bundle.phase_templates.len(),
                permission_rules: bundle.permission_rules.len(),
                budget_rules: bundle.budget_rules.len(),
                scripts: bundle.scripts.len(),
                tool_bindings: bundle.tool_bindings.len(),
            },
            left_out_findings,
        })
    })
    .await
    .map_err(|e| ConfigExportError::Validation(e.to_string()))?
}

#[tauri::command]
pub async fn config_export_write(
    app: AppHandle,
    path: String,
    groups: ExportGroups,
    #[allow(non_snake_case)] leaveOut: Vec<String>,
) -> Result<(), ConfigExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let db = app.state::<Db>();
        let conn = db.0.lock().map_err(|_| ConfigExportError::Poisoned)?;
        let leave_out: HashSet<String> = leaveOut.into_iter().collect();
        let bundle = build_bundle(&conn, &groups, &leave_out)?;
        drop(conn);
        let json = serde_json::to_string_pretty(&bundle)?;
        write_config_file(&path, &json)
    })
    .await
    .map_err(|e| ConfigExportError::Validation(e.to_string()))?
}

#[tauri::command]
pub async fn config_import_preview(
    app: AppHandle,
    path: String,
    #[allow(non_snake_case)] projectParent: Option<String>,
) -> Result<ImportPreview, ConfigExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| ConfigExportError::Validation(e.to_string()))?;
        let bundle: ConfigBundle = serde_json::from_str(&raw)?;
        if !is_supported_schema_version(bundle.schema_version) {
            return Err(ConfigExportError::SchemaMismatch {
                got: bundle.schema_version,
                expected: SCHEMA_VERSION,
            });
        }
        let db = app.state::<Db>();
        let conn = db.0.lock().map_err(|_| ConfigExportError::Poisoned)?;
        build_import_preview(&conn, &bundle, projectParent.as_deref())
    })
    .await
    .map_err(|e| ConfigExportError::Validation(e.to_string()))?
}

#[tauri::command]
pub async fn config_import_apply(
    app: AppHandle,
    path: String,
    #[allow(non_snake_case)] workspaceTargets: HashMap<String, String>,
    #[allow(non_snake_case)] resolvedProjectPaths: HashMap<String, String>,
) -> Result<ImportResult, ConfigExportError> {
    tauri::async_runtime::spawn_blocking(move || {
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| ConfigExportError::Validation(e.to_string()))?;
        let bundle: ConfigBundle = serde_json::from_str(&raw)?;
        let db = app.state::<Db>();
        let conn = db.0.lock().map_err(|_| ConfigExportError::Poisoned)?;
        apply_bundle(&conn, bundle, &workspaceTargets, &resolvedProjectPaths)
    })
    .await
    .map_err(|e| ConfigExportError::Validation(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iso_roundtrip() {
        let ms: i64 = 1_700_000_000_000;
        let iso = ms_col_to_iso(ms);
        let back = iso_to_ms(&iso).expect("parse failed");
        assert_eq!(back, ms, "ms={ms} iso={iso} back={back}");
    }

    #[test]
    fn schema_version_is_three() {
        assert_eq!(SCHEMA_VERSION, 3);
        assert!(is_supported_schema_version(1));
        assert!(is_supported_schema_version(2));
        assert!(is_supported_schema_version(3));
        assert!(!is_supported_schema_version(99));
    }

    #[test]
    fn default_groups_exclude_folder_paths_and_orchestrated_workflows() {
        let groups = ExportGroups::default();
        assert!(groups.workspaces);
        assert!(!groups.folder_paths);
        assert!(groups.workflows_yours);
        assert!(!groups.workflows_orchestrated);
    }

    #[test]
    fn workspace_slug_matches_the_desktop_shape() {
        assert_eq!(
            workspace_slug("Kay AM", "0efb8311-8d9c-4c85"),
            "kay-am-0efb8311"
        );
        assert_eq!(workspace_slug("  ", "1234abcd-0000"), "workspace-1234abcd");
    }

    fn bundled_workspace(root_path: Option<&str>, projects: Vec<ProjectBundle>) -> WorkspaceBundle {
        WorkspaceBundle {
            id: "workspace-1".to_string(),
            name: "Goodboy".to_string(),
            root_path: root_path.map(|s| s.to_string()),
            projects,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-02T00:00:00Z".to_string(),
            overrides: WorkspaceOverridesBundle::default(),
            profile: None,
        }
    }

    fn bundled_project(id: &str, root_path: &str, kind: &str) -> ProjectBundle {
        ProjectBundle {
            id: id.to_string(),
            name: "desktop".to_string(),
            root_path: Some(root_path.to_string()),
            kind: kind.to_string(),
            description: None,
            starred_at: None,
            base_branch: None,
            root_commit: None,
            remote_url: None,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-02T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn legacy_root_path_becomes_the_single_project() {
        let workspace = bundled_workspace(Some("/Users/dev/goodboy"), vec![]);
        let projects = workspace_projects(&workspace);
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, "workspace-1-project");
        assert_eq!(
            projects[0].root_path,
            Some("/Users/dev/goodboy".to_string())
        );
        assert_eq!(projects[0].kind, "repo");
    }

    #[test]
    fn bundled_projects_win_over_a_legacy_root_path() {
        let workspace = bundled_workspace(
            Some("/Users/dev/legacy"),
            vec![bundled_project(
                "project-1",
                "/Users/dev/goodboy",
                "unknown",
            )],
        );
        let projects = workspace_projects(&workspace);
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, "project-1");
        assert_eq!(projects[0].kind, "repo");
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
            scripts: vec![],
            tool_bindings: vec![],
            app_preferences: AppPreferencesBundle {
                editor_binary: Some("code".to_string()),
                editor_default: None,
                hidden_models_json: None,
            },
        };
        let json = serde_json::to_string(&bundle).expect("serialize failed");
        assert!(!json.contains("apiKey"), "json leaked apiKey");
        assert!(!json.contains("api_key"), "json leaked api_key");
        assert!(!json.contains("password"), "json leaked password");
        assert!(!json.contains("credential"), "json leaked credential");
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&json).expect("parse failed")
                ["schemaVersion"],
            serde_json::Value::Number(serde_json::Number::from(SCHEMA_VERSION))
        );
    }

    #[test]
    fn import_rejects_wrong_schema_version() {
        assert!(!is_supported_schema_version(99));
    }

    fn export_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT, created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL, default_provider_id TEXT, default_workflow_id TEXT,
                default_branch_prefix TEXT, default_verbosity TEXT, provider_bindings TEXT,
                task_models TEXT, role_models TEXT, parallel_agents INTEGER, provider_pool TEXT,
                attribution_footer INTEGER, reply_voice TEXT, reply_style_note TEXT,
                reply_template_fixed TEXT, reply_template_no_change TEXT, resolve_on_github INTEGER,
                resolve_commit_style TEXT, deleted_at INTEGER, disconnected_at INTEGER
            );
            CREATE TABLE projects (
                id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT NOT NULL, root_path TEXT NOT NULL,
                kind TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
                disconnected_at INTEGER, description TEXT, starred_at INTEGER, base_branch TEXT,
                root_commit TEXT, remote_url TEXT
            );
            CREATE TABLE skills (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
                description TEXT NOT NULL, file_path TEXT NOT NULL, body TEXT NOT NULL,
                frontmatter_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
            );
            CREATE TABLE workflows (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
                description TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
                is_preset INTEGER NOT NULL DEFAULT 1, origin TEXT, goal TEXT, process_text TEXT,
                deleted_at INTEGER
            );
            CREATE TABLE steps (
                id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
                name TEXT NOT NULL, prompt_prefix TEXT, provider_override TEXT, model_override TEXT,
                role TEXT, effort TEXT, expected_output TEXT, orchestrator_reason TEXT,
                deleted_at INTEGER
            );
            CREATE TABLE permission_rules (
                id TEXT PRIMARY KEY, scope TEXT NOT NULL, workspace_id TEXT, session_id TEXT,
                pattern_tool TEXT NOT NULL, pattern_args_matcher TEXT, decision TEXT NOT NULL,
                priority INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE budget_rules (
                id TEXT PRIMARY KEY, provider TEXT, period TEXT NOT NULL, cap_usd REAL NOT NULL,
                alert_threshold_pct REAL, created_at INTEGER NOT NULL
            );
            CREATE TABLE project_scripts (
                id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
            );
            CREATE TABLE integration_credentials (
                id TEXT PRIMARY KEY, provider TEXT NOT NULL, label TEXT NOT NULL,
                account TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
            );
            CREATE TABLE integration_bindings (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT, provider TEXT NOT NULL,
                credential_id TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}',
                created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX idx_integration_bindings_scope
              ON integration_bindings(workspace_id, COALESCE(project_id, ''), provider);
            CREATE TABLE workspace_profiles (
                workspace_id TEXT PRIMARY KEY, roles_json TEXT, about_work TEXT, working_rules TEXT,
                explain_more_json TEXT, updated_at INTEGER
            );
            CREATE TABLE security_findings (
                id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT, subject_kind TEXT NOT NULL,
                subject_id TEXT NOT NULL, secret_kind TEXT NOT NULL, fingerprint TEXT NOT NULL,
                last4 TEXT NOT NULL, first_seen_at INTEGER NOT NULL, dismissed_at INTEGER, resolved_at INTEGER
            );
            CREATE TABLE settings (
                key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn export_excludes_workspace_owned_rows_from_a_disconnected_workspace() {
        let conn = export_conn();
        conn.execute_batch(
            "INSERT INTO workspaces
               (id, name, created_at, updated_at, disconnected_at)
             VALUES
               ('active', 'Active', 1, 1, NULL),
               ('gone', 'Gone', 1, 1, 1);
             INSERT INTO skills
               (id, workspace_id, name, description, file_path, body, frontmatter_json,
                created_at, updated_at)
             VALUES
               ('skill-active', 'active', 'a', 'd', 'f', 'b', '{}', 1, 1),
               ('skill-gone', 'gone', 'a', 'd', 'f', 'b', '{}', 1, 1);
             INSERT INTO workflows
               (id, workspace_id, name, description, created_at, updated_at)
             VALUES
               ('workflow-active', 'active', 'w', 'd', 1, 1),
               ('workflow-gone', 'gone', 'w', 'd', 1, 1);
             INSERT INTO permission_rules
               (id, scope, workspace_id, session_id, pattern_tool, pattern_args_matcher,
                decision, priority, created_at, updated_at)
             VALUES
               ('rule-global', 'global', NULL, NULL, 'Bash', NULL, 'allow', 0, 1, 1),
               ('rule-active', 'workspace', 'active', NULL, 'Bash', NULL, 'allow', 0, 1, 1),
               ('rule-gone', 'workspace', 'gone', NULL, 'Bash', NULL, 'allow', 0, 1, 1);",
        )
        .unwrap();
        let bundle =
            build_bundle(&conn, &ExportGroups::default(), &HashSet::new()).expect("export failed");
        assert_eq!(
            bundle
                .skills
                .iter()
                .map(|s| s.id.as_str())
                .collect::<Vec<_>>(),
            vec!["skill-active"]
        );
        assert_eq!(
            bundle
                .phase_templates
                .iter()
                .map(|t| t.id.as_str())
                .collect::<Vec<_>>(),
            vec!["workflow-active"]
        );
        let mut rule_ids = bundle
            .permission_rules
            .iter()
            .map(|r| r.id.as_str())
            .collect::<Vec<_>>();
        rule_ids.sort_unstable();
        assert_eq!(rule_ids, vec!["rule-active", "rule-global"]);
    }

    #[test]
    fn folder_paths_group_off_by_default_omits_project_root_path() {
        let conn = export_conn();
        conn.execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);
             INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
             VALUES ('p', 'w', 'ledger-core', '/nerd/ledger-core', 'repo', 1, 1);",
        )
        .unwrap();
        let bundle =
            build_bundle(&conn, &ExportGroups::default(), &HashSet::new()).expect("export failed");
        assert_eq!(bundle.workspaces[0].projects[0].root_path, None);

        let mut with_paths = ExportGroups::default();
        with_paths.folder_paths = true;
        let bundle = build_bundle(&conn, &with_paths, &HashSet::new()).expect("export failed");
        assert_eq!(
            bundle.workspaces[0].projects[0].root_path,
            Some("/nerd/ledger-core".to_string())
        );
    }

    #[test]
    fn orchestrated_workflows_stay_out_unless_selected() {
        let conn = export_conn();
        conn.execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);
             INSERT INTO workflows (id, workspace_id, name, description, created_at, updated_at, origin)
             VALUES
               ('yours', 'w', 'Mine', 'd', 1, 1, NULL),
               ('orchestrated', 'w', 'Auto', 'd', 1, 1, 'orchestrated');",
        )
        .unwrap();
        let bundle =
            build_bundle(&conn, &ExportGroups::default(), &HashSet::new()).expect("export failed");
        assert_eq!(
            bundle
                .phase_templates
                .iter()
                .map(|t| t.id.as_str())
                .collect::<Vec<_>>(),
            vec!["yours"]
        );

        let mut with_orchestrated = ExportGroups::default();
        with_orchestrated.workflows_orchestrated = true;
        let bundle =
            build_bundle(&conn, &with_orchestrated, &HashSet::new()).expect("export failed");
        let mut ids = bundle
            .phase_templates
            .iter()
            .map(|t| t.id.as_str())
            .collect::<Vec<_>>();
        ids.sort_unstable();
        assert_eq!(ids, vec!["orchestrated", "yours"]);
    }

    #[test]
    fn preview_reports_open_findings_the_writer_can_leave_out() {
        let conn = export_conn();
        conn.execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);
             INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
             VALUES ('p', 'w', 'ledger-core', '/repo/ledger-core', 'repo', 1, 1);
             INSERT INTO project_scripts (id, project_id, name, body, created_at, updated_at)
             VALUES ('deploy', 'p', 'deploy', 'DEPLOY_TOKEN=ghp_secretvalue', 1, 1);
             INSERT INTO security_findings
               (id, workspace_id, subject_kind, subject_id, secret_kind, fingerprint, last4, first_seen_at)
             VALUES ('finding-1', 'w', 'script', 'deploy', 'github-token', 'fp-1', '3f9a', 1);",
        )
        .unwrap();

        let preview =
            open_findings_for_groups(&conn, &ExportGroups::default()).expect("preview failed");
        assert_eq!(preview.len(), 1);
        assert_eq!(preview[0].fingerprint, "fp-1");

        let bundle =
            build_bundle(&conn, &ExportGroups::default(), &HashSet::new()).expect("export failed");
        assert_eq!(
            bundle.scripts.len(),
            1,
            "nothing is left out until the writer names a fingerprint"
        );

        let mut leave_out = HashSet::new();
        leave_out.insert("fp-1".to_string());
        let bundle =
            build_bundle(&conn, &ExportGroups::default(), &leave_out).expect("export failed");
        assert!(
            bundle.scripts.is_empty(),
            "the named fingerprint's script is left out"
        );
    }

    #[test]
    fn import_relinks_a_colliding_project_to_the_importing_workspace() {
        let conn = export_conn();
        conn.execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at)
             VALUES ('other', 'Other', 1, 1);
             INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
             VALUES ('existing-project', 'other', 'old-name', '/repo/', 'repo', 1, 1);",
        )
        .unwrap();

        let bundle = ConfigBundle {
            schema_version: SCHEMA_VERSION,
            exported_at: "2026-01-01T00:00:00Z".to_string(),
            workspaces: vec![WorkspaceBundle {
                id: "importing".to_string(),
                name: "Importing".to_string(),
                root_path: None,
                projects: vec![bundled_project("imported-project", "/repo", "repo")],
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
                overrides: WorkspaceOverridesBundle::default(),
                profile: None,
            }],
            skills: vec![],
            phase_templates: vec![],
            permission_rules: vec![],
            budget_rules: vec![],
            scripts: vec![],
            tool_bindings: vec![],
            app_preferences: AppPreferencesBundle::default(),
        };

        apply_bundle(&conn, bundle, &HashMap::new(), &HashMap::new()).expect("import failed");

        let (workspace_id, name): (String, String) = conn
            .query_row(
                "SELECT workspace_id, name FROM projects WHERE id = 'existing-project'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("existing project should still be present");
        assert_eq!(workspace_id, "importing");
        assert_eq!(name, "desktop");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE id = 'imported-project'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            count, 0,
            "the colliding path should not create a duplicate project"
        );
    }

    #[test]
    fn workspace_target_merges_the_bundle_into_an_existing_workspace() {
        let conn = export_conn();
        conn.execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('existing', 'Existing', 1, 1);",
        )
        .unwrap();
        let bundle = ConfigBundle {
            schema_version: SCHEMA_VERSION,
            exported_at: "2026-01-01T00:00:00Z".to_string(),
            workspaces: vec![WorkspaceBundle {
                id: "from-other-mac".to_string(),
                name: "Renamed".to_string(),
                root_path: None,
                projects: vec![],
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
                overrides: WorkspaceOverridesBundle::default(),
                profile: None,
            }],
            skills: vec![],
            phase_templates: vec![],
            permission_rules: vec![],
            budget_rules: vec![],
            scripts: vec![],
            tool_bindings: vec![],
            app_preferences: AppPreferencesBundle::default(),
        };
        let mut targets = HashMap::new();
        targets.insert("from-other-mac".to_string(), "existing".to_string());

        apply_bundle(&conn, bundle, &targets, &HashMap::new()).expect("import failed");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM workspaces", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1, "merging must not create a second workspace row");
        let name: String = conn
            .query_row(
                "SELECT name FROM workspaces WHERE id = 'existing'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "Renamed");
    }

    #[test]
    fn project_without_a_resolved_path_is_skipped_and_counted() {
        let conn = export_conn();
        let bundle = ConfigBundle {
            schema_version: SCHEMA_VERSION,
            exported_at: "2026-01-01T00:00:00Z".to_string(),
            workspaces: vec![WorkspaceBundle {
                id: "w".to_string(),
                name: "W".to_string(),
                root_path: None,
                projects: vec![ProjectBundle {
                    id: "p".to_string(),
                    name: "ledger-core".to_string(),
                    root_path: None,
                    kind: "repo".to_string(),
                    description: None,
                    starred_at: None,
                    base_branch: None,
                    root_commit: None,
                    remote_url: None,
                    created_at: "2026-01-01T00:00:00Z".to_string(),
                    updated_at: "2026-01-01T00:00:00Z".to_string(),
                }],
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
                overrides: WorkspaceOverridesBundle::default(),
                profile: None,
            }],
            skills: vec![],
            phase_templates: vec![],
            permission_rules: vec![],
            budget_rules: vec![],
            scripts: vec![],
            tool_bindings: vec![],
            app_preferences: AppPreferencesBundle::default(),
        };

        let result =
            apply_bundle(&conn, bundle, &HashMap::new(), &HashMap::new()).expect("import failed");
        assert_eq!(result.stats.unresolved_projects, 1);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn scripts_round_trip_through_project_scripts_keyed_by_project() {
        let source = export_conn();
        source
            .execute_batch(
                "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);
                 INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
                 VALUES ('p', 'w', 'ledger-core', '/repo/ledger-core', 'repo', 1, 1);
                 INSERT INTO project_scripts (id, project_id, name, body, sort_order, created_at, updated_at)
                 VALUES ('deploy', 'p', 'deploy', 'echo hi', 2, 1, 1);",
            )
            .unwrap();

        let bundle = build_bundle(&source, &ExportGroups::default(), &HashSet::new())
            .expect("export failed");
        assert_eq!(bundle.scripts.len(), 1);
        assert_eq!(bundle.scripts[0].project_id, "p");
        assert_eq!(bundle.scripts[0].sort_order, 2);

        let target = export_conn();
        target
            .execute_batch(
                "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);
                 INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
                 VALUES ('p', 'w', 'ledger-core', '/repo/ledger-core', 'repo', 1, 1);",
            )
            .unwrap();
        apply_bundle(&target, bundle, &HashMap::new(), &HashMap::new()).expect("import failed");

        let (project_id, name, body): (String, String, String) = target
            .query_row(
                "SELECT project_id, name, body FROM project_scripts WHERE id = 'deploy'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("script imported");
        assert_eq!(project_id, "p");
        assert_eq!(name, "deploy");
        assert_eq!(body, "echo hi");
    }

    #[test]
    fn integration_binding_import_creates_a_credential_with_no_secret_when_none_exists() {
        let conn = export_conn();
        conn.execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);",
        )
        .unwrap();
        let bundle = ConfigBundle {
            schema_version: SCHEMA_VERSION,
            exported_at: "2026-01-01T00:00:00Z".to_string(),
            workspaces: vec![],
            skills: vec![],
            phase_templates: vec![],
            permission_rules: vec![],
            budget_rules: vec![],
            scripts: vec![],
            tool_bindings: vec![ToolBindingBundle {
                workspace_id: "w".to_string(),
                project_id: None,
                provider: "linear".to_string(),
                config_json: "{\"teamId\":\"team-1\"}".to_string(),
            }],
            app_preferences: AppPreferencesBundle::default(),
        };

        apply_bundle(&conn, bundle, &HashMap::new(), &HashMap::new()).expect("import failed");

        let (config, credential_id): (String, String) = conn
            .query_row(
                "SELECT config, credential_id FROM integration_bindings WHERE workspace_id = 'w' AND provider = 'linear'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("binding imported");
        assert_eq!(config, "{\"teamId\":\"team-1\"}");

        let account: String = conn
            .query_row(
                "SELECT account FROM integration_credentials WHERE id = ?1",
                [&credential_id],
                |row| row.get(0),
            )
            .expect("a credential row exists for the binding, with no secret written to it");
        assert_eq!(account, "", "import never writes a real account or token");
    }

    #[test]
    fn integration_binding_import_keeps_the_existing_credential_on_merge() {
        let conn = export_conn();
        conn.execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('existing-ws', 'Existing', 1, 1);
             INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
             VALUES ('cred-existing', 'linear', 'Linear', 'someone@example.com', 1, 1);
             INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
             VALUES ('binding-existing', 'existing-ws', NULL, 'linear', 'cred-existing', '{\"old\":true}', 1, 1);",
        )
        .unwrap();

        let bundle = ConfigBundle {
            schema_version: SCHEMA_VERSION,
            exported_at: "2026-01-01T00:00:00Z".to_string(),
            workspaces: vec![],
            skills: vec![],
            phase_templates: vec![],
            permission_rules: vec![],
            budget_rules: vec![],
            scripts: vec![],
            tool_bindings: vec![ToolBindingBundle {
                workspace_id: "from-other-mac".to_string(),
                project_id: None,
                provider: "linear".to_string(),
                config_json: "{\"new\":true}".to_string(),
            }],
            app_preferences: AppPreferencesBundle::default(),
        };
        let mut targets = HashMap::new();
        targets.insert("from-other-mac".to_string(), "existing-ws".to_string());

        apply_bundle(&conn, bundle, &targets, &HashMap::new()).expect("import failed");

        let (config, credential_id): (String, String) = conn
            .query_row(
                "SELECT config, credential_id FROM integration_bindings WHERE workspace_id = 'existing-ws' AND provider = 'linear'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("binding still present");
        assert_eq!(
            config, "{\"new\":true}",
            "config is updated from the import"
        );
        assert_eq!(
            credential_id, "cred-existing",
            "merging an import must never replace a working sign-in with a placeholder"
        );

        let credential_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM integration_credentials", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(
            credential_count, 1,
            "no placeholder credential is created when one already exists"
        );
    }
}
