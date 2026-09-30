use crate::config_export::bundle::{ConfigBundle, ProjectBundle};
use crate::config_export::convert::{normalized_root_path, workspace_projects};
use crate::config_export::error::ConfigExportError;
use crate::repo::{
    find_moved_projects_blocking, FindMovedProjectsArgs, MovedProjectInput, MovedProjectVerdict,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportManifest {
    pub schema_version: u32,
    pub exported_at: String,
    pub workspace_count: usize,
    pub project_count: usize,
    pub workflow_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceMatch {
    pub bundle_id: String,
    pub name: String,
    pub existing_id: Option<String>,
    pub action: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMatch {
    pub bundle_project_id: String,
    pub name: String,
    pub has_path: bool,
    pub resolved_path: Option<String>,
    pub verdict: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportGroupStat {
    pub group: String,
    pub adds: usize,
    pub updates: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub manifest: ImportManifest,
    pub workspace_matches: Vec<WorkspaceMatch>,
    pub project_matches: Vec<ProjectMatch>,
    pub group_stats: Vec<ImportGroupStat>,
}

fn count_id_group<'a>(
    conn: &rusqlite::Connection,
    table: &str,
    group: &str,
    ids: impl Iterator<Item = &'a str>,
) -> Result<ImportGroupStat, rusqlite::Error> {
    let sql = format!("SELECT 1 FROM {table} WHERE id = ?1 LIMIT 1");
    let mut stmt = conn.prepare(&sql)?;
    let mut adds = 0usize;
    let mut updates = 0usize;
    for id in ids {
        if stmt.exists(rusqlite::params![id])? {
            updates += 1;
        } else {
            adds += 1;
        }
    }
    Ok(ImportGroupStat {
        group: group.to_string(),
        adds,
        updates,
    })
}

fn project_group_stat(
    conn: &rusqlite::Connection,
    bundle: &ConfigBundle,
    project_matches: &[ProjectMatch],
) -> Result<ImportGroupStat, rusqlite::Error> {
    let all_projects: Vec<ProjectBundle> = bundle
        .workspaces
        .iter()
        .flat_map(workspace_projects)
        .collect();
    let mut stmt = conn.prepare("SELECT id, root_path FROM projects")?;
    let existing: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<_, _>>()?;
    let mut adds = 0usize;
    let mut updates = 0usize;
    for project in &all_projects {
        let Some(root_path) = project_matches
            .iter()
            .find(|m| m.bundle_project_id == project.id)
            .and_then(|m| m.resolved_path.as_deref())
        else {
            continue;
        };
        let target = normalized_root_path(root_path);
        let matched = existing
            .iter()
            .any(|(id, path)| *id == project.id || normalized_root_path(path) == target);
        if matched {
            updates += 1;
        } else {
            adds += 1;
        }
    }
    Ok(ImportGroupStat {
        group: "projects".to_string(),
        adds,
        updates,
    })
}

fn tool_binding_group_stat(
    conn: &rusqlite::Connection,
    bundle: &ConfigBundle,
) -> Result<ImportGroupStat, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT 1 FROM integration_bindings
         WHERE workspace_id = ?1 AND COALESCE(project_id, '') = COALESCE(?2, '') AND provider = ?3
         LIMIT 1",
    )?;
    let mut adds = 0usize;
    let mut updates = 0usize;
    for binding in &bundle.tool_bindings {
        let exists = stmt.exists(rusqlite::params![
            binding.workspace_id,
            binding.project_id,
            binding.provider,
        ])?;
        if exists {
            updates += 1;
        } else {
            adds += 1;
        }
    }
    Ok(ImportGroupStat {
        group: "toolBindings".to_string(),
        adds,
        updates,
    })
}

fn verdict_label(verdict: &MovedProjectVerdict) -> String {
    match verdict {
        MovedProjectVerdict::SameRepository => "same_repository".to_string(),
        MovedProjectVerdict::SameNameUnconfirmed => "same_name_unconfirmed".to_string(),
        MovedProjectVerdict::DifferentRepository => "different_repository".to_string(),
        MovedProjectVerdict::NotFound => "not_found".to_string(),
    }
}

pub(super) fn build_import_preview(
    conn: &rusqlite::Connection,
    bundle: &ConfigBundle,
    project_parent: Option<&str>,
) -> Result<ImportPreview, ConfigExportError> {
    let project_count: usize = bundle
        .workspaces
        .iter()
        .map(|w| workspace_projects(w).len())
        .sum();
    let manifest = ImportManifest {
        schema_version: bundle.schema_version,
        exported_at: bundle.exported_at.clone(),
        workspace_count: bundle.workspaces.len(),
        project_count,
        workflow_count: bundle.phase_templates.len(),
    };

    let mut workspace_matches = Vec::new();
    for w in &bundle.workspaces {
        let existing_by_id: Option<String> = conn
            .query_row(
                "SELECT id FROM workspaces WHERE id = ?1",
                rusqlite::params![w.id],
                |row| row.get(0),
            )
            .ok();
        let existing_by_name: Option<String> = if existing_by_id.is_some() {
            None
        } else {
            conn.query_row(
                "SELECT id FROM workspaces WHERE name = ?1 AND deleted_at IS NULL",
                rusqlite::params![w.name],
                |row| row.get(0),
            )
            .ok()
        };
        let existing_id = existing_by_id.or(existing_by_name);
        workspace_matches.push(WorkspaceMatch {
            bundle_id: w.id.clone(),
            name: w.name.clone(),
            existing_id: existing_id.clone(),
            action: if existing_id.is_some() {
                "merge".to_string()
            } else {
                "add".to_string()
            },
        });
    }

    let mut project_matches = Vec::new();
    let mut path_less_inputs: Vec<MovedProjectInput> = Vec::new();
    for w in &bundle.workspaces {
        for p in workspace_projects(w) {
            if p.root_path.is_none() {
                path_less_inputs.push(MovedProjectInput {
                    id: p.id.clone(),
                    name: p.name.clone(),
                    root_commit: p.root_commit.clone(),
                    remote_url: p.remote_url.clone(),
                });
            }
        }
    }
    let found_matches = match project_parent {
        Some(parent) if !path_less_inputs.is_empty() => {
            find_moved_projects_blocking(FindMovedProjectsArgs {
                parent: parent.to_string(),
                projects: path_less_inputs,
            })
        }
        _ => Vec::new(),
    };
    for w in &bundle.workspaces {
        for p in workspace_projects(w) {
            if let Some(path) = &p.root_path {
                project_matches.push(ProjectMatch {
                    bundle_project_id: p.id.clone(),
                    name: p.name.clone(),
                    has_path: true,
                    resolved_path: Some(path.clone()),
                    verdict: "same_repository".to_string(),
                });
                continue;
            }
            let found = found_matches.iter().find(|m| m.project_id == p.id);
            project_matches.push(ProjectMatch {
                bundle_project_id: p.id.clone(),
                name: p.name.clone(),
                has_path: false,
                resolved_path: found.and_then(|m| m.path.clone()),
                verdict: found
                    .map(|m| verdict_label(&m.verdict))
                    .unwrap_or_else(|| "not_found".to_string()),
            });
        }
    }

    let (workspace_adds, workspace_updates) =
        workspace_matches
            .iter()
            .fold((0usize, 0usize), |(adds, updates), m| {
                if m.action == "add" {
                    (adds + 1, updates)
                } else {
                    (adds, updates + 1)
                }
            });
    let mut group_stats = vec![
        ImportGroupStat {
            group: "workspaces".to_string(),
            adds: workspace_adds,
            updates: workspace_updates,
        },
        project_group_stat(conn, bundle, &project_matches)?,
        count_id_group(
            conn,
            "skills",
            "skills",
            bundle.skills.iter().map(|s| s.id.as_str()),
        )?,
        count_id_group(
            conn,
            "workflows",
            "phaseTemplates",
            bundle.phase_templates.iter().map(|t| t.id.as_str()),
        )?,
        count_id_group(
            conn,
            "permission_rules",
            "permissionRules",
            bundle.permission_rules.iter().map(|r| r.id.as_str()),
        )?,
        count_id_group(
            conn,
            "budget_rules",
            "budgetRules",
            bundle.budget_rules.iter().map(|b| b.id.as_str()),
        )?,
        count_id_group(
            conn,
            "project_scripts",
            "scripts",
            bundle.scripts.iter().map(|s| s.id.as_str()),
        )?,
        tool_binding_group_stat(conn, bundle)?,
    ];
    group_stats.retain(|stat| stat.adds > 0 || stat.updates > 0);

    Ok(ImportPreview {
        manifest,
        workspace_matches,
        project_matches,
        group_stats,
    })
}

#[cfg(test)]
mod tests;
