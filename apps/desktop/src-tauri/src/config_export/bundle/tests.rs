use super::{
    editor_binary_to_import, is_supported_schema_version, AppPreferencesBundle, ConfigBundle,
    SCHEMA_VERSION,
};

#[test]
fn schema_version_is_three() {
    assert_eq!(SCHEMA_VERSION, 3);
    assert!(is_supported_schema_version(1));
    assert!(is_supported_schema_version(2));
    assert!(is_supported_schema_version(3));
    assert!(!is_supported_schema_version(99));
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
        serde_json::from_str::<serde_json::Value>(&json).expect("parse failed")["schemaVersion"],
        serde_json::Value::Number(serde_json::Number::from(SCHEMA_VERSION))
    );
}

#[test]
fn import_reads_a_legacy_editor_default_into_editor_binary() {
    let prefs: AppPreferencesBundle =
        serde_json::from_str(r#"{"editorDefault":"zed"}"#).expect("parse failed");
    assert_eq!(editor_binary_to_import(&prefs), Some("zed"));
}

#[test]
fn import_keeps_editor_binary_over_a_legacy_editor_default() {
    let prefs: AppPreferencesBundle =
        serde_json::from_str(r#"{"editorBinary":"cursor","editorDefault":"zed"}"#)
            .expect("parse failed");
    assert_eq!(editor_binary_to_import(&prefs), Some("cursor"));
}

#[test]
fn import_skips_the_editor_when_the_bundle_names_none() {
    assert_eq!(
        editor_binary_to_import(&AppPreferencesBundle::default()),
        None
    );
}

#[test]
fn export_never_writes_editor_default() {
    let prefs = AppPreferencesBundle {
        editor_binary: Some("code".to_string()),
        editor_default: Some("zed".to_string()),
        hidden_models_json: None,
    };
    let json = serde_json::to_string(&prefs).expect("serialize failed");
    assert!(!json.contains("editorDefault"), "json kept editorDefault");
    assert!(json.contains("editorBinary"));
}

#[test]
fn import_rejects_wrong_schema_version() {
    assert!(!is_supported_schema_version(99));
}

#[test]
fn workspace_overrides_json_accepts_the_legacy_string_encoded_shape() {
    let legacy = serde_json::json!({
        "schemaVersion": SCHEMA_VERSION,
        "exportedAt": "2026-01-01T00:00:00Z",
        "workspaces": [{
            "id": "w",
            "name": "W",
            "projects": [],
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-01T00:00:00Z",
            "overrides": {
                "defaultProviderId": null,
                "defaultBranchPrefix": null,
                "providerBindingsJson": "{\"anthropic\":\"acct-legacy\"}",
            },
        }],
        "skills": [],
        "phaseTemplates": [],
        "permissionRules": [],
        "budgetRules": [],
    });

    let bundle: ConfigBundle =
        serde_json::from_str(&legacy.to_string()).expect("legacy shape must still parse");
    assert_eq!(
        bundle.workspaces[0].overrides.provider_bindings,
        Some(serde_json::json!({"anthropic": "acct-legacy"}))
    );
}
