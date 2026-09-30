use serde::{Deserialize, Serialize};

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

#[cfg(test)]
mod tests;
