use super::{build_bundle, open_findings_for_groups};
use crate::config_export::fixtures::export_conn;
use crate::config_export::groups::ExportGroups;
use std::collections::HashSet;

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

    let with_paths = ExportGroups {
        folder_paths: true,
        ..Default::default()
    };
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

    let with_orchestrated = ExportGroups {
        workflows_orchestrated: true,
        ..Default::default()
    };
    let bundle = build_bundle(&conn, &with_orchestrated, &HashSet::new()).expect("export failed");
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
    let bundle = build_bundle(&conn, &ExportGroups::default(), &leave_out).expect("export failed");
    assert!(
        bundle.scripts.is_empty(),
        "the named fingerprint's script is left out"
    );
}
