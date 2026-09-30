use super::build_import_preview;
use crate::config_export::bundle::{
    AppPreferencesBundle, ConfigBundle, SkillBundle, ToolBindingBundle, WorkspaceBundle,
    WorkspaceOverridesBundle, SCHEMA_VERSION,
};
use crate::config_export::fixtures::{bundled_project, export_conn};

#[test]
fn import_preview_group_stats_split_adds_from_updates() {
    let conn = export_conn();
    conn.execute_batch(
        "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ('existing-ws', 'Existing', 1, 1);
         INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
         VALUES ('existing-project', 'existing-ws', 'ledger-core', '/repo/existing', 'repo', 1, 1);
         INSERT INTO skills (id, workspace_id, name, description, file_path, body, frontmatter_json, created_at, updated_at)
         VALUES ('existing-skill', 'existing-ws', 'a', 'd', 'f', 'b', '{}', 1, 1);",
    )
    .unwrap();

    let bundle = ConfigBundle {
        schema_version: SCHEMA_VERSION,
        exported_at: "2026-01-01T00:00:00Z".to_string(),
        workspaces: vec![
            WorkspaceBundle {
                id: "existing-ws".to_string(),
                name: "Existing".to_string(),
                root_path: None,
                projects: vec![bundled_project(
                    "imported-project-1",
                    "/repo/existing",
                    "repo",
                )],
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
                overrides: WorkspaceOverridesBundle::default(),
                profile: None,
            },
            WorkspaceBundle {
                id: "new-ws".to_string(),
                name: "New".to_string(),
                root_path: None,
                projects: vec![bundled_project("imported-project-2", "/repo/new", "repo")],
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
                overrides: WorkspaceOverridesBundle::default(),
                profile: None,
            },
        ],
        skills: vec![
            SkillBundle {
                id: "existing-skill".to_string(),
                workspace_id: "existing-ws".to_string(),
                name: "a".to_string(),
                description: "d".to_string(),
                file_path: "f".to_string(),
                body: "b".to_string(),
                frontmatter_json: "{}".to_string(),
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
            },
            SkillBundle {
                id: "new-skill".to_string(),
                workspace_id: "new-ws".to_string(),
                name: "b".to_string(),
                description: "d".to_string(),
                file_path: "f".to_string(),
                body: "b".to_string(),
                frontmatter_json: "{}".to_string(),
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
            },
        ],
        phase_templates: vec![],
        permission_rules: vec![],
        budget_rules: vec![],
        scripts: vec![],
        tool_bindings: vec![ToolBindingBundle {
            workspace_id: "existing-ws".to_string(),
            project_id: None,
            provider: "linear".to_string(),
            config_json: "{}".to_string(),
        }],
        app_preferences: AppPreferencesBundle::default(),
    };

    let preview = build_import_preview(&conn, &bundle, None).expect("preview failed");
    let stat = |group: &str| {
        preview
            .group_stats
            .iter()
            .find(|s| s.group == group)
            .unwrap_or_else(|| panic!("missing group_stats entry for {group}"))
    };

    let workspaces = stat("workspaces");
    assert_eq!((workspaces.adds, workspaces.updates), (1, 1));
    let projects = stat("projects");
    assert_eq!((projects.adds, projects.updates), (1, 1));
    let skills = stat("skills");
    assert_eq!((skills.adds, skills.updates), (1, 1));
    let tool_bindings = stat("toolBindings");
    assert_eq!((tool_bindings.adds, tool_bindings.updates), (1, 0));

    for empty_group in [
        "phaseTemplates",
        "permissionRules",
        "budgetRules",
        "scripts",
    ] {
        assert!(
            preview.group_stats.iter().all(|s| s.group != empty_group),
            "empty group {empty_group} should be left out of the preview"
        );
    }
}
