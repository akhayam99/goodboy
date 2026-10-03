use super::apply_bundle;
use crate::config_export::bundle::{
    AppPreferencesBundle, ConfigBundle, ProjectBundle, ToolBindingBundle, WorkspaceBundle,
    WorkspaceOverridesBundle, SCHEMA_VERSION,
};
use crate::config_export::export::build_bundle;
use crate::config_export::fixtures::{bundled_project, export_conn};
use crate::config_export::groups::ExportGroups;
use std::collections::HashMap;
use std::collections::HashSet;

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

    let bundle =
        build_bundle(&source, &ExportGroups::default(), &HashSet::new()).expect("export failed");
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
fn workspace_overrides_json_round_trips_as_a_typed_value_not_a_string() {
    let source = export_conn();
    source
        .execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at, provider_bindings, provider_pool)
             VALUES ('w', 'W', 1, 1, '{\"anthropic\":\"acct-1\"}', '[\"anthropic\",\"openai\"]');",
        )
        .unwrap();

    let bundle =
        build_bundle(&source, &ExportGroups::default(), &HashSet::new()).expect("export failed");
    let overrides = &bundle.workspaces[0].overrides;
    assert_eq!(
        overrides.provider_bindings,
        Some(serde_json::json!({"anthropic": "acct-1"}))
    );
    assert_eq!(
        overrides.provider_pool,
        Some(serde_json::json!(["anthropic", "openai"]))
    );

    let json = serde_json::to_string(&bundle).expect("serialize failed");
    assert!(
        json.contains("\"providerBindings\":{\"anthropic\":\"acct-1\"}"),
        "provider bindings must serialize as a nested object, not an escaped string: {json}"
    );

    let target = export_conn();
    target
        .execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);",
        )
        .unwrap();
    apply_bundle(&target, bundle, &HashMap::new(), &HashMap::new()).expect("import failed");
    let stored: String = target
        .query_row(
            "SELECT provider_bindings FROM workspaces WHERE id = 'w'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&stored).unwrap(),
        serde_json::json!({"anthropic": "acct-1"})
    );
}

#[test]
fn a_provider_policy_travels_through_the_bundle_at_the_same_schema_version() {
    let source = export_conn();
    source
        .execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at, provider_pool)
             VALUES ('w', 'W', 1, 1, '[{\"id\":\"codex\",\"state\":\"on\"},{\"id\":\"cursor\",\"state\":\"backup\",\"payAsYouGo\":true}]');",
        )
        .unwrap();
    let policy = serde_json::json!([
        { "id": "codex", "state": "on" },
        { "id": "cursor", "state": "backup", "payAsYouGo": true }
    ]);

    let bundle =
        build_bundle(&source, &ExportGroups::default(), &HashSet::new()).expect("export failed");
    assert_eq!(bundle.schema_version, SCHEMA_VERSION);
    assert_eq!(
        bundle.workspaces[0].overrides.provider_pool,
        Some(policy.clone())
    );

    let target = export_conn();
    target
        .execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);",
        )
        .unwrap();
    apply_bundle(&target, bundle, &HashMap::new(), &HashMap::new()).expect("import failed");
    let stored: String = target
        .query_row(
            "SELECT provider_pool FROM workspaces WHERE id = 'w'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&stored).unwrap(),
        policy
    );
}

#[test]
fn the_branch_template_travels_through_the_bundle_at_the_same_schema_version() {
    let source = export_conn();
    source
        .execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at, default_branch_prefix, default_branch_template)
             VALUES ('w', 'W', 1, 1, 'team/hl', '{prefix}/{user}/{task-id}-{slug}');",
        )
        .unwrap();

    let bundle =
        build_bundle(&source, &ExportGroups::default(), &HashSet::new()).expect("export failed");
    assert_eq!(bundle.schema_version, SCHEMA_VERSION);
    assert_eq!(
        bundle.workspaces[0]
            .overrides
            .default_branch_template
            .as_deref(),
        Some("{prefix}/{user}/{task-id}-{slug}")
    );

    let target = export_conn();
    target
        .execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);",
        )
        .unwrap();
    apply_bundle(&target, bundle, &HashMap::new(), &HashMap::new()).expect("import failed");
    let stored: (String, String) = target
        .query_row(
            "SELECT default_branch_prefix, default_branch_template FROM workspaces WHERE id = 'w'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(
        stored,
        (
            "team/hl".to_string(),
            "{prefix}/{user}/{task-id}-{slug}".to_string()
        )
    );
}

#[test]
fn a_bundle_from_before_the_branch_template_imports_without_one() {
    let overrides: WorkspaceOverridesBundle =
        serde_json::from_str(r#"{"defaultProviderId":null,"defaultBranchPrefix":"hl"}"#)
            .expect("an older bundle still parses");
    assert_eq!(overrides.default_branch_prefix.as_deref(), Some("hl"));
    assert_eq!(overrides.default_branch_template, None);
}

#[test]
fn the_workflow_rules_travel_through_the_bundle_and_restore() {
    let rules = r#"{"autonomy":"plan","spendLimitUsd":25,"spendLimitMode":"pause","spreadByHeadroom":false,"standingGuidance":"- Open the PR as a draft.","guidanceRoles":["implementer","docs"]}"#;
    let source = export_conn();
    source
        .execute(
            "INSERT INTO workspaces (id, name, created_at, updated_at, workflow_rules)
             VALUES ('w', 'W', 1, 1, ?1)",
            rusqlite::params![rules],
        )
        .unwrap();

    let bundle =
        build_bundle(&source, &ExportGroups::default(), &HashSet::new()).expect("export failed");
    let exported = bundle.workspaces[0]
        .overrides
        .workflow_rules
        .clone()
        .expect("rules exported");
    assert_eq!(exported["autonomy"], "plan");
    assert_eq!(exported["spendLimitUsd"], 25);

    let target = export_conn();
    target
        .execute_batch(
            "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('w', 'W', 1, 1);",
        )
        .unwrap();
    apply_bundle(&target, bundle, &HashMap::new(), &HashMap::new()).expect("import failed");
    let stored: String = target
        .query_row(
            "SELECT workflow_rules FROM workspaces WHERE id = 'w'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&stored).unwrap();
    let original: serde_json::Value = serde_json::from_str(rules).unwrap();
    assert_eq!(parsed, original);
}

#[test]
fn a_bundle_from_before_the_workflow_rules_imports_without_them() {
    let overrides: WorkspaceOverridesBundle =
        serde_json::from_str(r#"{"defaultProviderId":null,"defaultBranchPrefix":"hl"}"#)
            .expect("an older bundle still parses");
    assert_eq!(overrides.workflow_rules, None);
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
