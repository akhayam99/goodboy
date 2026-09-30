use super::{iso_to_ms, ms_col_to_iso, workspace_projects, workspace_slug};
use crate::config_export::bundle::{ProjectBundle, WorkspaceBundle, WorkspaceOverridesBundle};
use crate::config_export::fixtures::bundled_project;

#[test]
fn iso_roundtrip() {
    let ms: i64 = 1_700_000_000_000;
    let iso = ms_col_to_iso(ms);
    let back = iso_to_ms(&iso).expect("parse failed");
    assert_eq!(back, ms, "ms={ms} iso={iso} back={back}");
}

#[test]
fn workspace_slug_matches_the_desktop_shape() {
    assert_eq!(
        workspace_slug("Kay AM", "0efb8311-8d9c-4c85"),
        "kay-am-0efb8311"
    );
    assert_eq!(workspace_slug("  ", "1234abcd-0000"), "workspace-1234abcd");
}

fn bundled_workspace(root_path: Option<&str>, projects: Vec<ProjectBundle>) -> WorkspaceBundle {
    WorkspaceBundle {
        id: "workspace-1".to_string(),
        name: "Goodboy".to_string(),
        root_path: root_path.map(|s| s.to_string()),
        projects,
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-02T00:00:00Z".to_string(),
        overrides: WorkspaceOverridesBundle::default(),
        profile: None,
    }
}

#[test]
fn legacy_root_path_becomes_the_single_project() {
    let workspace = bundled_workspace(Some("/Users/dev/goodboy"), vec![]);
    let projects = workspace_projects(&workspace);
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].id, "workspace-1-project");
    assert_eq!(
        projects[0].root_path,
        Some("/Users/dev/goodboy".to_string())
    );
    assert_eq!(projects[0].kind, "repo");
}

#[test]
fn bundled_projects_win_over_a_legacy_root_path() {
    let workspace = bundled_workspace(
        Some("/Users/dev/legacy"),
        vec![bundled_project(
            "project-1",
            "/Users/dev/goodboy",
            "unknown",
        )],
    );
    let projects = workspace_projects(&workspace);
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].id, "project-1");
    assert_eq!(projects[0].kind, "repo");
}
