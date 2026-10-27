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
    crate::test_support::migrated_connection()
}
