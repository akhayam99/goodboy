use crate::config_export::bundle::ProjectBundle;

pub(super) fn bundled_project(id: &str, root_path: &str, kind: &str) -> ProjectBundle {
    ProjectBundle {
        id: id.to_string(),
        name: "desktop".to_string(),
        root_path: Some(root_path.to_string()),
        kind: kind.to_string(),
        description: None,
        starred_at: None,
        base_branch: None,
        root_commit: None,
        remote_url: None,
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-02T00:00:00Z".to_string(),
    }
}

pub(super) fn export_conn() -> rusqlite::Connection {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE workspaces (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT, created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL, default_provider_id TEXT, default_workflow_id TEXT,
            default_branch_prefix TEXT, default_verbosity TEXT, provider_bindings TEXT,
            task_models TEXT, role_models TEXT, parallel_agents INTEGER, provider_pool TEXT,
            attribution_footer INTEGER, reply_voice TEXT, reply_style_note TEXT,
            reply_template_fixed TEXT, reply_template_no_change TEXT, resolve_on_github INTEGER,
            resolve_commit_style TEXT, deleted_at INTEGER, disconnected_at INTEGER
        );
        CREATE TABLE projects (
            id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT NOT NULL, root_path TEXT NOT NULL,
            kind TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            disconnected_at INTEGER, description TEXT, starred_at INTEGER, base_branch TEXT,
            root_commit TEXT, remote_url TEXT
        );
        CREATE TABLE skills (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
            description TEXT NOT NULL, file_path TEXT NOT NULL, body TEXT NOT NULL,
            frontmatter_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE TABLE workflows (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
            description TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            is_preset INTEGER NOT NULL DEFAULT 1, origin TEXT, goal TEXT, process_text TEXT,
            deleted_at INTEGER
        );
        CREATE TABLE steps (
            id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
            name TEXT NOT NULL, prompt_prefix TEXT, provider_override TEXT, model_override TEXT,
            role TEXT, effort TEXT, expected_output TEXT, orchestrator_reason TEXT,
            deleted_at INTEGER
        );
        CREATE TABLE permission_rules (
            id TEXT PRIMARY KEY, scope TEXT NOT NULL, workspace_id TEXT, session_id TEXT,
            pattern_tool TEXT NOT NULL, pattern_args_matcher TEXT, decision TEXT NOT NULL,
            priority INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE budget_rules (
            id TEXT PRIMARY KEY, provider TEXT, period TEXT NOT NULL, cap_usd REAL NOT NULL,
            alert_threshold_pct REAL, created_at INTEGER NOT NULL
        );
        CREATE TABLE project_scripts (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE TABLE integration_credentials (
            id TEXT PRIMARY KEY, provider TEXT NOT NULL, label TEXT NOT NULL,
            account TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE TABLE integration_bindings (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT, provider TEXT NOT NULL,
            credential_id TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}',
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX idx_integration_bindings_scope
          ON integration_bindings(workspace_id, COALESCE(project_id, ''), provider);
        CREATE TABLE workspace_profiles (
            workspace_id TEXT PRIMARY KEY, roles_json TEXT, about_work TEXT, working_rules TEXT,
            explain_more_json TEXT, updated_at INTEGER
        );
        CREATE TABLE security_findings (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT, subject_kind TEXT NOT NULL,
            subject_id TEXT NOT NULL, secret_kind TEXT NOT NULL, fingerprint TEXT NOT NULL,
            last4 TEXT NOT NULL, first_seen_at INTEGER NOT NULL, dismissed_at INTEGER, resolved_at INTEGER
        );
        CREATE TABLE settings (
            key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
        );",
    )
    .unwrap();
    conn
}
