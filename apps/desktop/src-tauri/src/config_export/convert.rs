use crate::config_export::bundle::{ProjectBundle, WorkspaceBundle};

pub(super) fn ms_col_to_iso(ms: i64) -> String {
    crate::util::ms_to_iso(ms)
}

pub(super) fn iso_to_ms(s: &str) -> Option<i64> {
    crate::util::iso_to_ms(s)
}

pub(super) fn workspace_slug(name: &str, id: &str) -> String {
    let mut prefix = String::new();
    let mut pending_dash = false;
    for ch in name.to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            if pending_dash && !prefix.is_empty() {
                prefix.push('-');
            }
            pending_dash = false;
            prefix.push(ch);
        } else {
            pending_dash = true;
        }
        if prefix.len() >= 32 {
            break;
        }
    }
    let stem = if prefix.is_empty() {
        "workspace"
    } else {
        prefix.as_str()
    };
    let suffix: String = id.chars().take(8).collect();
    format!("{stem}-{suffix}")
}

pub(super) fn workspace_projects(workspace: &WorkspaceBundle) -> Vec<ProjectBundle> {
    if !workspace.projects.is_empty() {
        return workspace
            .projects
            .iter()
            .map(|project| ProjectBundle {
                id: project.id.clone(),
                name: project.name.clone(),
                root_path: project.root_path.clone(),
                kind: normalized_kind(&project.kind),
                description: project.description.clone(),
                starred_at: project.starred_at.clone(),
                base_branch: project.base_branch.clone(),
                root_commit: project.root_commit.clone(),
                remote_url: project.remote_url.clone(),
                created_at: project.created_at.clone(),
                updated_at: project.updated_at.clone(),
            })
            .collect();
    }
    match &workspace.root_path {
        Some(root_path) if !root_path.trim().is_empty() => vec![ProjectBundle {
            id: format!("{}-project", workspace.id),
            name: workspace.name.clone(),
            root_path: Some(root_path.clone()),
            kind: "repo".to_string(),
            description: None,
            starred_at: None,
            base_branch: None,
            root_commit: None,
            remote_url: None,
            created_at: workspace.created_at.clone(),
            updated_at: workspace.updated_at.clone(),
        }],
        _ => Vec::new(),
    }
}

fn normalized_kind(kind: &str) -> String {
    match kind {
        "folder" => "folder".to_string(),
        _ => "repo".to_string(),
    }
}

pub(super) fn normalized_root_path(path: &str) -> String {
    let mut normalized = path.to_string();
    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    normalized
}

#[cfg(test)]
mod tests;
