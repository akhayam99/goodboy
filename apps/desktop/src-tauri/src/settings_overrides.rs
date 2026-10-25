use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::State;
use thiserror::Error;

use crate::db::{Db, DbError};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsOverrides {
    pub default_provider_id: Option<String>,
    pub default_branch_prefix: Option<String>,
    pub default_verbosity: Option<String>,
    pub provider_bindings: Option<Value>,
    pub task_models: Option<Value>,
    pub role_models: Option<Value>,
    pub parallel_agents: Option<bool>,
    pub provider_pool: Option<Value>,
    pub attribution_footer: Option<bool>,
    pub reply_voice: Option<String>,
    pub reply_style_note: Option<String>,
    pub reply_template_fixed: Option<String>,
    pub reply_template_no_change: Option<String>,
    pub resolve_on_github: Option<bool>,
    pub resolve_commit_style: Option<String>,
    pub after_merge: Option<String>,
    pub default_branch_template: Option<String>,
    pub workflow_rules: Option<Value>,
}

#[derive(Debug, Error)]
pub enum OverridesError {
    #[error(transparent)]
    Db(#[from] DbError),
    #[error("{0} is not a workspace setting")]
    UnknownKey(String),
    #[error("{0} does not accept this value")]
    InvalidValue(String),
    #[error("workspace {0} does not exist")]
    NoSuchWorkspace(String),
}

impl OverridesError {
    fn kind(&self) -> &'static str {
        match self {
            OverridesError::Db(error) => error.kind(),
            OverridesError::UnknownKey(_) => "unknown_setting",
            OverridesError::InvalidValue(_) => "invalid_setting_value",
            OverridesError::NoSuchWorkspace(_) => "no_such_workspace",
        }
    }
}

impl From<rusqlite::Error> for OverridesError {
    fn from(error: rusqlite::Error) -> Self {
        OverridesError::Db(DbError::Sqlite(error))
    }
}

crate::util::impl_error_serialize!(OverridesError);

pub const OVERRIDE_COLUMNS: [&str; 18] = [
    "default_provider_id",
    "default_branch_prefix",
    "default_verbosity",
    "provider_bindings",
    "task_models",
    "role_models",
    "parallel_agents",
    "provider_pool",
    "attribution_footer",
    "reply_voice",
    "reply_style_note",
    "reply_template_fixed",
    "reply_template_no_change",
    "resolve_on_github",
    "resolve_commit_style",
    "after_merge",
    "default_branch_template",
    "workflow_rules",
];

pub(crate) fn override_select_list() -> String {
    OVERRIDE_COLUMNS.join(", ")
}

pub(crate) fn override_placeholders(first: usize) -> String {
    (0..OVERRIDE_COLUMNS.len())
        .map(|offset| format!("?{}", first + offset))
        .collect::<Vec<_>>()
        .join(", ")
}

pub(crate) fn override_excluded_assignments() -> String {
    OVERRIDE_COLUMNS
        .iter()
        .map(|column| format!("{column} = excluded.{column}"))
        .collect::<Vec<_>>()
        .join(", ")
}

pub(crate) fn wire_key(column: &str) -> String {
    let mut parts = column.split('_');
    let first = parts.next().unwrap_or_default().to_string();
    parts.fold(first, |mut word, part| {
        let mut letters = part.chars();
        if let Some(initial) = letters.next() {
            word.push(initial.to_ascii_uppercase());
            word.extend(letters);
        }
        word
    })
}

fn json_from_text(raw: Option<String>) -> Option<Value> {
    raw.and_then(|s| serde_json::from_str(&s).ok())
}

const PROVIDER_POLICY_STATES: [&str; 3] = ["on", "backup", "off"];

fn is_policy_entry(entry: &Value) -> bool {
    let Some(object) = entry.as_object() else {
        return false;
    };
    let has_id = object.get("id").is_some_and(Value::is_string);
    let has_state = object
        .get("state")
        .and_then(Value::as_str)
        .is_some_and(|state| PROVIDER_POLICY_STATES.contains(&state));
    has_id && has_state
}

fn provider_pool_shape(value: Value) -> Option<Value> {
    let items = value.as_array()?;
    let is_names = items.iter().all(Value::is_string);
    let is_policy = items.iter().all(is_policy_entry);
    if is_names || is_policy {
        return Some(value);
    }
    None
}

fn provider_pool_from_text(raw: Option<String>) -> Option<Value> {
    json_from_text(raw).and_then(provider_pool_shape)
}

enum ColumnKind {
    Text,
    Flag,
    Json,
    Pool,
}

fn column_kind(column: &str) -> Option<ColumnKind> {
    match column {
        "default_provider_id"
        | "default_branch_prefix"
        | "default_verbosity"
        | "reply_voice"
        | "reply_style_note"
        | "reply_template_fixed"
        | "reply_template_no_change"
        | "resolve_commit_style"
        | "after_merge"
        | "default_branch_template" => Some(ColumnKind::Text),
        "parallel_agents" | "attribution_footer" | "resolve_on_github" => Some(ColumnKind::Flag),
        "provider_bindings" | "task_models" | "role_models" | "workflow_rules" => {
            Some(ColumnKind::Json)
        }
        "provider_pool" => Some(ColumnKind::Pool),
        _ => None,
    }
}

fn column_of_wire_key(key: &str) -> Option<&'static str> {
    OVERRIDE_COLUMNS
        .iter()
        .copied()
        .find(|column| wire_key(column) == key)
}

fn sql_value(kind: &ColumnKind, key: &str, value: &Value) -> Result<SqlValue, OverridesError> {
    if value.is_null() {
        return Ok(SqlValue::Null);
    }
    let invalid = || OverridesError::InvalidValue(key.to_string());
    match kind {
        ColumnKind::Text => value
            .as_str()
            .map(|text| SqlValue::Text(text.to_string()))
            .ok_or_else(invalid),
        ColumnKind::Flag => value
            .as_bool()
            .map(|flag| SqlValue::Integer(i64::from(flag)))
            .ok_or_else(invalid),
        ColumnKind::Json => {
            if !value.is_object() {
                return Err(invalid());
            }
            Ok(SqlValue::Text(value.to_string()))
        }
        ColumnKind::Pool => provider_pool_shape(value.clone())
            .map(|shape| SqlValue::Text(shape.to_string()))
            .ok_or_else(invalid),
    }
}

fn constraint_error(error: rusqlite::Error, columns: &[&'static str]) -> OverridesError {
    let rusqlite::Error::SqliteFailure(failure, message) = &error else {
        return OverridesError::from(error);
    };
    if failure.code != rusqlite::ErrorCode::ConstraintViolation {
        return OverridesError::from(error);
    }
    let named = message
        .as_deref()
        .and_then(|text| columns.iter().find(|column| text.contains(**column)));
    match named.or(columns.first()) {
        Some(column) => OverridesError::InvalidValue(wire_key(column)),
        None => OverridesError::from(error),
    }
}

fn overrides_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SettingsOverrides> {
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
        provider_pool: provider_pool_from_text(row.get(7)?),
        attribution_footer: attribution_footer_raw.map(|v| v != 0),
        reply_voice: row.get(9)?,
        reply_style_note: row.get(10)?,
        reply_template_fixed: row.get(11)?,
        reply_template_no_change: row.get(12)?,
        resolve_on_github: resolve_on_github_raw.map(|v| v != 0),
        resolve_commit_style: row.get(14)?,
        after_merge: row.get(15)?,
        default_branch_template: row.get(16)?,
        workflow_rules: json_from_text(row.get(17)?),
    })
}

fn read_workspace_overrides(
    conn: &rusqlite::Connection,
    workspace_id: &str,
) -> rusqlite::Result<Option<SettingsOverrides>> {
    conn.query_row(
        &format!(
            "SELECT {} FROM workspaces WHERE id = ?1",
            override_select_list()
        ),
        rusqlite::params![workspace_id],
        overrides_from_row,
    )
    .optional()
}

pub(crate) fn patch_overrides(
    conn: &rusqlite::Connection,
    workspace_id: &str,
    patch: &Map<String, Value>,
) -> Result<SettingsOverrides, OverridesError> {
    let mut columns: Vec<&'static str> = Vec::new();
    let mut values: Vec<SqlValue> = Vec::new();
    for (key, value) in patch {
        let column =
            column_of_wire_key(key).ok_or_else(|| OverridesError::UnknownKey(key.clone()))?;
        let kind = column_kind(column).ok_or_else(|| OverridesError::UnknownKey(key.clone()))?;
        columns.push(column);
        values.push(sql_value(&kind, key, value)?);
    }
    if !columns.is_empty() {
        let assignments = columns
            .iter()
            .enumerate()
            .map(|(index, column)| format!("{column} = ?{}", index + 1))
            .collect::<Vec<_>>()
            .join(", ");
        let count = columns.len();
        values.push(SqlValue::Integer(crate::util::now_ms()));
        values.push(SqlValue::Text(workspace_id.to_string()));
        let changed = conn
            .execute(
                &format!(
                    "UPDATE workspaces SET {assignments}, updated_at = ?{} WHERE id = ?{}",
                    count + 1,
                    count + 2
                ),
                params_from_iter(values.iter()),
            )
            .map_err(|error| constraint_error(error, &columns))?;
        if changed == 0 {
            return Err(OverridesError::NoSuchWorkspace(workspace_id.to_string()));
        }
    }
    read_workspace_overrides(conn, workspace_id)?
        .ok_or_else(|| OverridesError::NoSuchWorkspace(workspace_id.to_string()))
}

#[tauri::command]
pub async fn get_workspace_overrides(
    state: State<'_, Db>,
    workspace_id: String,
) -> Result<Option<SettingsOverrides>, DbError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    Ok(read_workspace_overrides(&conn, &workspace_id)?)
}

#[tauri::command]
pub async fn patch_workspace_overrides(
    state: State<'_, Db>,
    workspace_id: String,
    patch: Map<String, Value>,
) -> Result<SettingsOverrides, OverridesError> {
    let conn = state.0.lock().map_err(|_| DbError::Poisoned)?;
    patch_overrides(&conn, &workspace_id, &patch)
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
            after_merge: None,
            default_branch_template: None,
            workflow_rules: None,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row.map_err(DbError::Sqlite)?)),
        None => Ok(None),
    }
}

#[cfg(test)]
mod wire_shape;

#[cfg(test)]
mod tests {
    use super::*;

    const WORKSPACE_COLUMNS_THAT_ARE_NOT_OVERRIDES: [&str; 9] = [
        "id",
        "name",
        "slug",
        "created_at",
        "updated_at",
        "deleted_at",
        "disconnected_at",
        "last_accessed_at",
        "default_permission_mode",
    ];

    fn sorted(mut names: Vec<String>) -> Vec<String> {
        names.sort();
        names
    }

    fn wire_keys(value: Value) -> Vec<String> {
        let object = value.as_object().expect("the wire value is an object");
        sorted(object.keys().cloned().collect())
    }

    fn declared_wire_keys() -> Vec<String> {
        sorted(OVERRIDE_COLUMNS.iter().map(|c| wire_key(c)).collect())
    }

    fn workspace_conn() -> rusqlite::Connection {
        let conn = crate::test_support::migrated_connection();
        conn.execute_batch(
            "INSERT INTO workspaces (id, name, slug, created_at, updated_at)
             VALUES ('w', 'Harborline', 'harborline', 1, 1);",
        )
        .expect("workspace inserts");
        conn
    }

    fn patch_of(value: Value) -> Map<String, Value> {
        value.as_object().expect("a patch is an object").clone()
    }

    fn column_text(conn: &rusqlite::Connection, column: &str) -> Option<String> {
        conn.query_row(
            &format!("SELECT {column} FROM workspaces WHERE id = 'w'"),
            [],
            |row| row.get(0),
        )
        .expect("column reads")
    }

    #[test]
    fn the_column_list_names_every_override_column_of_the_migrated_workspaces_table() {
        let conn = crate::test_support::migrated_connection();
        let mut statement = conn
            .prepare("PRAGMA table_info(workspaces)")
            .expect("pragma prepares");
        let columns: Vec<String> = statement
            .query_map([], |row| row.get::<_, String>(1))
            .expect("pragma runs")
            .map(|name| name.expect("column name reads"))
            .collect();

        let declared: Vec<String> = OVERRIDE_COLUMNS
            .iter()
            .chain(WORKSPACE_COLUMNS_THAT_ARE_NOT_OVERRIDES.iter())
            .map(|column| column.to_string())
            .collect();

        assert_eq!(sorted(declared), sorted(columns));
    }

    #[test]
    fn the_column_list_has_no_column_twice() {
        let unique: std::collections::HashSet<&&str> = OVERRIDE_COLUMNS.iter().collect();

        assert_eq!(unique.len(), OVERRIDE_COLUMNS.len());
    }

    #[test]
    fn the_settings_struct_carries_exactly_the_declared_columns() {
        let conn = workspace_conn();
        let stored = read_workspace_overrides(&conn, "w")
            .expect("row reads")
            .expect("workspace exists");

        let encoded = serde_json::to_value(&stored).expect("serialize overrides");

        assert_eq!(wire_keys(encoded), declared_wire_keys());
    }

    #[test]
    fn every_declared_column_has_a_value_kind() {
        for column in OVERRIDE_COLUMNS {
            assert!(column_kind(column).is_some(), "{column} has no value kind");
        }
    }

    #[test]
    fn the_sql_helpers_follow_the_declared_order() {
        assert_eq!(override_select_list().split(", ").count(), 18);
        assert!(override_select_list().starts_with("default_provider_id, default_branch_prefix"));
        assert!(override_placeholders(6).starts_with("?6, ?7"));
        assert!(override_placeholders(6).ends_with("?23"));
        assert!(override_excluded_assignments().contains("after_merge = excluded.after_merge"));
    }

    #[test]
    fn two_interleaved_patches_both_land_and_the_second_returns_the_stored_row() {
        let conn = workspace_conn();

        let first = patch_overrides(
            &conn,
            "w",
            &patch_of(serde_json::json!({ "defaultBranchPrefix": "hl" })),
        )
        .expect("first patch");
        let second = patch_overrides(
            &conn,
            "w",
            &patch_of(serde_json::json!({ "parallelAgents": true })),
        )
        .expect("second patch");

        assert_eq!(first.default_branch_prefix.as_deref(), Some("hl"));
        assert_eq!(first.parallel_agents, None);
        assert_eq!(second.default_branch_prefix.as_deref(), Some("hl"));
        assert_eq!(second.parallel_agents, Some(true));
        assert_eq!(
            column_text(&conn, "default_branch_prefix").as_deref(),
            Some("hl")
        );
    }

    #[test]
    fn a_patch_from_a_stale_window_writes_only_the_keys_it_names() {
        let conn = workspace_conn();
        conn.execute_batch(
            "UPDATE workspaces SET after_merge = 'local', reply_voice = 'terse' WHERE id = 'w';",
        )
        .expect("another window saved");

        let stored = patch_overrides(
            &conn,
            "w",
            &patch_of(serde_json::json!({ "defaultVerbosity": "brief" })),
        )
        .expect("patch");

        assert_eq!(stored.default_verbosity.as_deref(), Some("brief"));
        assert_eq!(stored.after_merge.as_deref(), Some("local"));
        assert_eq!(stored.reply_voice.as_deref(), Some("terse"));
    }

    #[test]
    fn a_null_clears_one_key() {
        let conn = workspace_conn();
        conn.execute_batch("UPDATE workspaces SET default_branch_prefix = 'hl' WHERE id = 'w';")
            .expect("seed");

        let stored = patch_overrides(
            &conn,
            "w",
            &patch_of(serde_json::json!({ "defaultBranchPrefix": null })),
        )
        .expect("patch");

        assert_eq!(stored.default_branch_prefix, None);
        assert_eq!(column_text(&conn, "default_branch_prefix"), None);
    }

    #[test]
    fn an_empty_patch_writes_nothing_and_returns_the_stored_row() {
        let conn = workspace_conn();

        let stored = patch_overrides(&conn, "w", &Map::new()).expect("patch");

        assert_eq!(stored.default_branch_prefix, None);
        let updated_at: i64 = conn
            .query_row(
                "SELECT updated_at FROM workspaces WHERE id = 'w'",
                [],
                |row| row.get(0),
            )
            .expect("updated_at reads");
        assert_eq!(updated_at, 1);
    }

    #[test]
    fn a_provider_pool_of_neither_shape_is_rejected_and_nothing_is_written() {
        let conn = workspace_conn();
        let patch = patch_of(serde_json::json!({
            "defaultBranchPrefix": "hl",
            "providerPool": ["codex", { "id": "anthropic", "state": "on" }],
        }));

        let outcome = patch_overrides(&conn, "w", &patch);

        assert!(matches!(
            outcome,
            Err(OverridesError::InvalidValue(ref key)) if key == "providerPool"
        ));
        assert_eq!(column_text(&conn, "default_branch_prefix"), None);
        assert_eq!(column_text(&conn, "provider_pool"), None);
    }

    #[test]
    fn both_provider_pool_shapes_are_stored_as_sent() {
        let conn = workspace_conn();

        patch_overrides(
            &conn,
            "w",
            &patch_of(serde_json::json!({ "providerPool": ["codex", "anthropic"] })),
        )
        .expect("names");
        assert_eq!(
            column_text(&conn, "provider_pool").as_deref(),
            Some(r#"["codex","anthropic"]"#)
        );

        let stored = patch_overrides(
            &conn,
            "w",
            &patch_of(serde_json::json!({
                "providerPool": [
                    { "id": "codex", "state": "on", "keepAfterLimit": true },
                    { "id": "cursor", "state": "backup", "payAsYouGo": true },
                    { "id": "gemini", "state": "off" }
                ]
            })),
        )
        .expect("policy");

        assert_eq!(
            stored.provider_pool,
            Some(serde_json::json!([
                { "id": "codex", "state": "on", "keepAfterLimit": true },
                { "id": "cursor", "state": "backup", "payAsYouGo": true },
                { "id": "gemini", "state": "off" }
            ]))
        );
    }

    #[test]
    fn a_value_the_database_would_refuse_comes_back_as_a_named_setting() {
        let conn = workspace_conn();
        let patch = patch_of(serde_json::json!({
            "defaultBranchPrefix": "hl",
            "replyVoice": "shouting",
        }));

        let outcome = patch_overrides(&conn, "w", &patch);

        let Err(error) = outcome else {
            panic!("the voice should be refused");
        };
        assert!(matches!(error, OverridesError::InvalidValue(ref key) if key == "replyVoice"));
        assert!(!error.to_string().to_lowercase().contains("constraint"));
        assert_eq!(column_text(&conn, "default_branch_prefix"), None);
    }

    #[test]
    fn a_value_of_the_wrong_type_is_refused() {
        let conn = workspace_conn();

        for (key, bad) in [
            ("parallelAgents", serde_json::json!("yes")),
            ("defaultBranchPrefix", serde_json::json!(7)),
            ("workflowRules", serde_json::json!(["plan"])),
            ("providerBindings", serde_json::json!("codex")),
        ] {
            let outcome = patch_overrides(&conn, "w", &patch_of(serde_json::json!({ key: bad })));

            assert!(
                matches!(outcome, Err(OverridesError::InvalidValue(ref named)) if named == key),
                "{key} should be refused"
            );
        }
    }

    #[test]
    fn a_key_that_is_not_a_workspace_setting_is_refused() {
        let conn = workspace_conn();

        let outcome = patch_overrides(
            &conn,
            "w",
            &patch_of(serde_json::json!({ "defaultPermissionMode": "plan" })),
        );

        assert!(matches!(outcome, Err(OverridesError::UnknownKey(_))));
    }

    #[test]
    fn a_patch_for_a_workspace_that_does_not_exist_is_refused() {
        let conn = workspace_conn();

        let outcome = patch_overrides(
            &conn,
            "missing",
            &patch_of(serde_json::json!({ "defaultBranchPrefix": "hl" })),
        );

        assert!(matches!(outcome, Err(OverridesError::NoSuchWorkspace(_))));
    }

    #[test]
    fn the_json_columns_store_what_was_sent_and_read_back_as_values() {
        let conn = workspace_conn();

        let stored = patch_overrides(
            &conn,
            "w",
            &patch_of(serde_json::json!({
                "workflowRules": { "autonomy": "plan", "spreadByHeadroom": false },
                "providerBindings": { "anthropic": "credential-harborline" },
            })),
        )
        .expect("patch");

        assert_eq!(
            stored.workflow_rules,
            Some(serde_json::json!({ "autonomy": "plan", "spreadByHeadroom": false }))
        );
        assert_eq!(
            stored.provider_bindings,
            Some(serde_json::json!({ "anthropic": "credential-harborline" }))
        );
    }

    #[test]
    fn a_provider_pool_of_neither_shape_reads_as_none() {
        let mixed = Some(r#"["codex",{"id":"anthropic","state":"on"}]"#.to_string());
        let unknown_state = Some(r#"[{"id":"codex","state":"sometimes"}]"#.to_string());
        let not_a_list = Some(r#"{"codex":"on"}"#.to_string());

        assert_eq!(provider_pool_from_text(mixed), None);
        assert_eq!(provider_pool_from_text(unknown_state), None);
        assert_eq!(provider_pool_from_text(not_a_list), None);
    }

    #[test]
    fn the_older_reader_falls_back_to_every_provider_on_the_new_shape() {
        let conn = workspace_conn();
        patch_overrides(
            &conn,
            "w",
            &patch_of(serde_json::json!({
                "providerPool": [{ "id": "codex", "state": "on" }]
            })),
        )
        .expect("patch");
        let older: Option<Vec<String>> =
            column_text(&conn, "provider_pool").and_then(|value| serde_json::from_str(&value).ok());

        assert_eq!(older, None);
    }
}
