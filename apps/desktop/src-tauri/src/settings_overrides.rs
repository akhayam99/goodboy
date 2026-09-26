use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{Db, DbError};

#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsOverrides {
    #[serde(rename = "defaultProviderId")]
    pub default_provider_id: Option<String>,
    #[serde(rename = "defaultBranchPrefix")]
    pub default_branch_prefix: Option<String>,
    #[serde(rename = "defaultVerbosity")]
    pub default_verbosity: Option<String>,
    #[serde(rename = "providerBindings")]
    pub provider_bindings: Option<serde_json::Value>,
    #[serde(rename = "taskModels")]
    pub task_models: Option<serde_json::Value>,
    #[serde(rename = "roleModels")]
    pub role_models: Option<serde_json::Value>,
    #[serde(rename = "parallelAgents")]
    pub parallel_agents: Option<bool>,
    #[serde(rename = "providerPool")]
    pub provider_pool: Option<Vec<String>>,
    #[serde(rename = "attributionFooter")]
    pub attribution_footer: Option<bool>,
    #[serde(rename = "replyVoice", default)]
    pub reply_voice: Option<String>,
    #[serde(rename = "replyStyleNote", default)]
    pub reply_style_note: Option<String>,
    #[serde(rename = "replyTemplateFixed", default)]
    pub reply_template_fixed: Option<String>,
    #[serde(rename = "replyTemplateNoChange", default)]
    pub reply_template_no_change: Option<String>,
    #[serde(rename = "resolveOnGithub", default)]
    pub resolve_on_github: Option<bool>,
    #[serde(rename = "resolveCommitStyle", default)]
    pub resolve_commit_style: Option<String>,
}

fn bool_to_int(value: Option<bool>) -> Option<i64> {
    value.map(|v| if v { 1 } else { 0 })
}

fn json_to_text(value: &Option<serde_json::Value>) -> Option<String> {
    match value {
        Some(serde_json::Value::Null) | None => None,
        Some(v) => Some(v.to_string()),
    }
}

fn json_from_text(raw: Option<String>) -> Option<serde_json::Value> {
    raw.and_then(|s| serde_json::from_str(&s).ok())
}

fn string_array_to_text(value: &Option<Vec<String>>) -> Option<String> {
    value
        .as_ref()
        .and_then(|items| serde_json::to_string(items).ok())
}

fn string_array_from_text(raw: Option<String>) -> Option<Vec<String>> {
    raw.and_then(|value| serde_json::from_str(&value).ok())
}

#[tauri::command]
pub async fn get_workspace_overrides(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Option<SettingsOverrides>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT default_provider_id, default_branch_prefix, default_verbosity, provider_bindings, task_models, role_models, parallel_agents, provider_pool, attribution_footer,
                reply_voice, reply_style_note, reply_template_fixed, reply_template_no_change, resolve_on_github, resolve_commit_style
         FROM workspaces WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![workspace_id], |row| {
        let parallel_agents_raw: Option<i64> = row.get(6)?;
        let attribution_footer_raw: Option<i64> = row.get(8)?;
        let resolve_on_github_raw: Option<i64> = row.get(13)?;
        Ok(SettingsOverrides {
            default_provider_id: row.get(0)?,
            default_branch_prefix: row.get(1)?,
            default_verbosity: row.get(2)?,
            provider_bindings: json_from_text(row.get(3)?),
            task_models: json_from_text(row.get(4)?),
            role_models: json_from_text(row.get(5)?),
            parallel_agents: parallel_agents_raw.map(|v| v != 0),
            provider_pool: string_array_from_text(row.get(7)?),
            attribution_footer: attribution_footer_raw.map(|v| v != 0),
            reply_voice: row.get(9)?,
            reply_style_note: row.get(10)?,
            reply_template_fixed: row.get(11)?,
            reply_template_no_change: row.get(12)?,
            resolve_on_github: resolve_on_github_raw.map(|v| v != 0),
            resolve_commit_style: row.get(14)?,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(DbError::Sqlite)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn set_workspace_overrides(
    state: State<'_, Db>,
    workspace_id: String,
    overrides: SettingsOverrides,
) -> Result<(), DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let parallel_agents_val: Option<i64> = overrides.parallel_agents.map(|v| if v { 1 } else { 0 });
    let attribution_footer_val: Option<i64> =
        overrides.attribution_footer.map(|v| if v { 1 } else { 0 });
    let now = crate::util::now_ms();
    conn.execute(
        "UPDATE workspaces
         SET default_provider_id = ?1,
             default_branch_prefix = ?2,
             default_verbosity = ?3,
             provider_bindings = ?4,
             task_models = ?5,
             role_models = ?6,
             parallel_agents = ?7,
             provider_pool = ?8,
             attribution_footer = ?9,
             reply_voice = ?10,
             reply_style_note = ?11,
             reply_template_fixed = ?12,
             reply_template_no_change = ?13,
             resolve_on_github = ?14,
             resolve_commit_style = ?15,
             updated_at = ?16
         WHERE id = ?17",
        rusqlite::params![
            overrides.default_provider_id,
            overrides.default_branch_prefix,
            overrides.default_verbosity,
            json_to_text(&overrides.provider_bindings),
            json_to_text(&overrides.task_models),
            json_to_text(&overrides.role_models),
            parallel_agents_val,
            string_array_to_text(&overrides.provider_pool),
            attribution_footer_val,
            overrides.reply_voice,
            overrides.reply_style_note,
            overrides.reply_template_fixed,
            overrides.reply_template_no_change,
            bool_to_int(overrides.resolve_on_github),
            overrides.resolve_commit_style,
            now,
            workspace_id,
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn get_session_overrides(
    state: State<'_, Db>,
    session_id: String,
) -> Result<Option<SettingsOverrides>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    let mut stmt = conn.prepare(
        "SELECT default_provider_id, default_branch_prefix, provider_bindings
         FROM sessions WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![session_id], |row| {
        Ok(SettingsOverrides {
            default_provider_id: row.get(0)?,
            default_branch_prefix: row.get(1)?,
            default_verbosity: None,
            provider_bindings: json_from_text(row.get(2)?),
            task_models: None,
            role_models: None,
            parallel_agents: None,
            provider_pool: None,
            attribution_footer: None,
            reply_voice: None,
            reply_style_note: None,
            reply_template_fixed: None,
            reply_template_no_change: None,
            resolve_on_github: None,
            resolve_commit_style: None,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(DbError::Sqlite)?)),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_provider_pool_survives_the_wire_names_the_frontend_sends() {
        let payload = serde_json::json!({
            "defaultProviderId": "anthropic",
            "defaultBranchPrefix": null,
            "defaultVerbosity": null,
            "providerBindings": null,
            "taskModels": null,
            "roleModels": null,
            "parallelAgents": null,
            "providerPool": ["anthropic", "codex"],
            "attributionFooter": null,
        });

        let overrides: SettingsOverrides =
            serde_json::from_value(payload).expect("deserialize overrides");

        assert_eq!(
            overrides.provider_pool,
            Some(vec!["anthropic".to_string(), "codex".to_string()])
        );

        let encoded = serde_json::to_value(&overrides).expect("serialize overrides");
        assert_eq!(
            encoded.get("providerPool"),
            Some(&serde_json::json!(["anthropic", "codex"]))
        );
        assert!(encoded.get("enabledProviders").is_none());
    }

    #[test]
    fn reply_settings_travel_on_the_wire_and_default_when_absent() {
        let payload = serde_json::json!({
            "defaultProviderId": null,
            "defaultBranchPrefix": null,
            "defaultVerbosity": null,
            "providerBindings": null,
            "taskModels": null,
            "roleModels": null,
            "parallelAgents": null,
            "providerPool": null,
            "attributionFooter": null,
            "replyVoice": "friendly",
            "resolveOnGithub": false,
            "resolveCommitStyle": "fixup",
        });

        let overrides: SettingsOverrides =
            serde_json::from_value(payload).expect("deserialize overrides");

        assert_eq!(overrides.reply_voice.as_deref(), Some("friendly"));
        assert_eq!(overrides.resolve_on_github, Some(false));
        assert_eq!(overrides.resolve_commit_style.as_deref(), Some("fixup"));
        assert_eq!(overrides.reply_template_fixed, None);
        let encoded = serde_json::to_value(&overrides).expect("serialize overrides");
        assert_eq!(
            encoded.get("replyVoice"),
            Some(&serde_json::json!("friendly"))
        );
        assert_eq!(
            encoded.get("replyStyleNote"),
            Some(&serde_json::Value::Null)
        );
    }

    #[test]
    fn an_absent_provider_pool_reads_back_as_none() {
        let overrides: SettingsOverrides =
            serde_json::from_value(serde_json::json!({})).expect("deserialize overrides");

        assert_eq!(overrides.provider_pool, None);
        assert_eq!(string_array_to_text(&overrides.provider_pool), None);
    }

    #[test]
    fn the_provider_pool_column_text_round_trips() {
        let pool = Some(vec!["anthropic".to_string(), "codex".to_string()]);
        let text = string_array_to_text(&pool);

        assert_eq!(text.as_deref(), Some(r#"["anthropic","codex"]"#));
        assert_eq!(string_array_from_text(text), pool);
    }
}
