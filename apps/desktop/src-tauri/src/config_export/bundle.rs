use serde::{Deserialize, Serialize};

pub(super) const SCHEMA_VERSION: u32 = 3;
const LEGACY_SCHEMA_VERSIONS: [u32; 2] = [1, 2];

pub(super) fn is_supported_schema_version(version: u32) -> bool {
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
#[serde(rename_all = "camelCase")]
pub struct WorkspaceBundle {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_path: Option<String>,
    #[serde(default)]
    pub projects: Vec<ProjectBundle>,
    pub created_at: String,
    pub updated_at: String,
    pub overrides: WorkspaceOverridesBundle,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile: Option<ProfileBundle>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBundle {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_path: Option<String>,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub starred_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_commit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn normalize_json_ish(raw: serde_json::Value) -> Option<serde_json::Value> {
    match raw {
        serde_json::Value::Null => None,
        serde_json::Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                serde_json::from_str(trimmed).ok()
            }
        }
        other => Some(other),
    }
}

fn deserialize_json_ish<'de, D>(deserializer: D) -> Result<Option<serde_json::Value>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let raw = serde_json::Value::deserialize(deserializer)?;
    Ok(normalize_json_ish(raw))
}

pub(super) fn json_text_to_value(text: Option<String>) -> Option<serde_json::Value> {
    text.and_then(|s| normalize_json_ish(serde_json::Value::String(s)))
}

pub(super) fn json_value_to_text(value: &Option<serde_json::Value>) -> Option<String> {
    value.as_ref().map(|v| v.to_string())
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceOverridesBundle {
    pub default_provider_id: Option<String>,
    pub default_branch_prefix: Option<String>,
    #[serde(default)]
    pub default_verbosity: Option<String>,
    #[serde(
        default,
        alias = "providerBindingsJson",
        deserialize_with = "deserialize_json_ish"
    )]
    pub provider_bindings: Option<serde_json::Value>,
    #[serde(
        default,
        alias = "taskModelsJson",
        deserialize_with = "deserialize_json_ish"
    )]
    pub task_models: Option<serde_json::Value>,
    #[serde(
        default,
        alias = "roleModelsJson",
        deserialize_with = "deserialize_json_ish"
    )]
    pub role_models: Option<serde_json::Value>,
    #[serde(default)]
    pub parallel_agents: Option<bool>,
    #[serde(
        default,
        alias = "providerPoolJson",
        deserialize_with = "deserialize_json_ish"
    )]
    pub provider_pool: Option<serde_json::Value>,
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
    #[serde(default)]
    pub default_branch_template: Option<String>,
    #[serde(default, deserialize_with = "deserialize_json_ish")]
    pub workflow_rules: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillBundle {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub file_path: String,
    pub body: String,
    pub frontmatter_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseDefinitionBundle {
    pub id: String,
    pub workflow_id: String,
    pub ordinal: i64,
    pub name: String,
    pub prompt_prefix: String,
    pub provider_override: Option<String>,
    pub model_override: Option<String>,
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub effort: Option<String>,
    #[serde(default)]
    pub expected_output: Option<String>,
    #[serde(default)]
    pub orchestrator_reason: Option<String>,
}

fn default_is_preset() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseTemplateBundle {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<PhaseDefinitionBundle>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default = "default_is_preset")]
    pub is_preset: bool,
    #[serde(default)]
    pub origin: Option<String>,
    #[serde(default)]
    pub goal: Option<String>,
    #[serde(default)]
    pub process_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRuleBundle {
    pub id: String,
    pub scope: String,
    pub workspace_id: Option<String>,
    pub session_id: Option<String>,
    pub pattern_tool: String,
    pub pattern_args_matcher: Option<String>,
    pub decision: String,
    pub priority: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetRuleBundle {
    pub id: String,
    pub provider: String,
    pub period: String,
    pub cap_usd: f64,
    pub alert_threshold_pct: f64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptBundle {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub body: String,
    #[serde(default)]
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolBindingBundle {
    pub workspace_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    pub provider: String,
    pub config_json: String,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferencesBundle {
    pub editor_binary: Option<String>,
    #[serde(default, skip_serializing)]
    pub editor_default: Option<String>,
    pub hidden_models_json: Option<String>,
}

pub(super) fn editor_binary_to_import(prefs: &AppPreferencesBundle) -> Option<&str> {
    prefs
        .editor_binary
        .as_deref()
        .or(prefs.editor_default.as_deref())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigBundle {
    pub schema_version: u32,
    pub exported_at: String,
    pub workspaces: Vec<WorkspaceBundle>,
    pub skills: Vec<SkillBundle>,
    pub phase_templates: Vec<PhaseTemplateBundle>,
    pub permission_rules: Vec<PermissionRuleBundle>,
    pub budget_rules: Vec<BudgetRuleBundle>,
    #[serde(default)]
    pub scripts: Vec<ScriptBundle>,
    #[serde(default)]
    pub tool_bindings: Vec<ToolBindingBundle>,
    #[serde(default)]
    pub app_preferences: AppPreferencesBundle,
}

#[cfg(test)]
mod tests;
