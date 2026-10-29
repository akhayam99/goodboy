use super::error::WorktreeError;
use super::git::{git, RunGit};
use super::inspect::inspect_worktree_with;
use super::setup_proposal::setup_proposal_blocking;
use super::types::WorktreeInspection;
use serde::Serialize;
use std::path::{Component, Path, PathBuf};

const MAX_NAMES: usize = 5;
const MAX_WORKSPACE_DIRS: usize = 300;
const NODE_FOLDER: &str = "node_modules";
const COMPOSER_FOLDER: &str = "vendor";

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DepsState {
    Ready,
    Missing,
    Outside,
    NotApplicable,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DepsCheck {
    pub state: DepsState,
    pub command: Option<String>,
    pub source: Option<String>,
    pub folder: Option<String>,
    pub is_folder_link: bool,
    pub outside: Vec<String>,
}

#[derive(Debug, PartialEq, Eq)]
struct OutsideLink {
    path: PathBuf,
    name: String,
    is_folder: bool,
}

fn not_applicable() -> DepsCheck {
    DepsCheck {
        state: DepsState::NotApplicable,
        command: None,
        source: None,
        folder: None,
        is_folder_link: false,
        outside: Vec::new(),
    }
}

fn folder_of(source: &str) -> &'static str {
    match source {
        "composer.lock" => COMPOSER_FOLDER,
        _ => NODE_FOLDER,
    }
}

fn install_command(command: &str) -> String {
    match command {
        "pnpm install" => "pnpm install --frozen-lockfile".to_string(),
        other => other.to_string(),
    }
}

fn has_entries(manifest: &serde_json::Value, keys: &[&str]) -> bool {
    keys.iter().any(|key| {
        manifest
            .get(*key)
            .and_then(serde_json::Value::as_object)
            .is_some_and(|entries| !entries.is_empty())
    })
}

fn needs_dependencies(root: &Path, source: &str) -> bool {
    let manifest_name = match source {
        "composer.lock" => "composer.json",
        _ => "package.json",
    };
    let Some(manifest) = std::fs::read_to_string(root.join(manifest_name))
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
    else {
        return false;
    };
    if source == "composer.lock" {
        return has_entries(&manifest, &["require", "require-dev"]);
    }
    has_entries(
        &manifest,
        &["dependencies", "devDependencies", "optionalDependencies"],
    ) || manifest.get("workspaces").is_some()
        || root.join("pnpm-workspace.yaml").is_file()
}

fn normalized(path: &Path) -> PathBuf {
    path.components()
        .fold(PathBuf::new(), |mut built, component| {
            match component {
                Component::ParentDir => {
                    built.pop();
                }
                Component::CurDir => {}
                other => built.push(other.as_os_str()),
            }
            built
        })
}

fn resolves_inside(link: &Path, canonical_root: &Path) -> bool {
    if let Ok(target) = std::fs::canonicalize(link) {
        return target.starts_with(canonical_root);
    }
    let Ok(raw) = std::fs::read_link(link) else {
        return true;
    };
    let parent = link.parent().unwrap_or(link);
    let target = normalized(&parent.join(raw));
    target.starts_with(canonical_root) || target.starts_with(normalized(canonical_root))
}

fn is_link(path: &Path) -> bool {
    std::fs::symlink_metadata(path).is_ok_and(|meta| meta.file_type().is_symlink())
}

fn entry_paths(folder: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(folder) else {
        return Vec::new();
    };
    let mut paths: Vec<PathBuf> = entries.flatten().map(|entry| entry.path()).collect();
    paths.sort();
    paths
}

fn leaf_of(path: &Path) -> &str {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
}

fn is_dotted(path: &Path) -> bool {
    leaf_of(path).starts_with('.')
}

fn linked_entries_outside(folder: &Path, canonical_root: &Path, label: &str) -> Vec<OutsideLink> {
    let mut found = Vec::new();
    for path in entry_paths(folder) {
        if is_dotted(&path) {
            continue;
        }
        let name = leaf_of(&path).to_string();
        let is_scope = name.starts_with('@') && path.is_dir() && !is_link(&path);
        let members = match is_scope {
            true => entry_paths(&path),
            false => vec![path.clone()],
        };
        for member in members {
            if !is_link(&member) || resolves_inside(&member, canonical_root) {
                continue;
            }
            let shown = match is_scope {
                true => format!("{label}/{name}/{}", leaf_of(&member)),
                false => format!("{label}/{}", leaf_of(&member)),
            };
            found.push(OutsideLink {
                path: member,
                name: shown,
                is_folder: false,
            });
        }
    }
    found
}

fn is_plain_dir(path: &Path) -> bool {
    !is_dotted(path) && !is_link(path) && path.is_dir() && leaf_of(path) != NODE_FOLDER
}

fn workspace_dirs(root: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    for first in entry_paths(root) {
        if dirs.len() >= MAX_WORKSPACE_DIRS {
            break;
        }
        if !is_plain_dir(&first) {
            continue;
        }
        dirs.push(first.clone());
        for second in entry_paths(&first) {
            if dirs.len() >= MAX_WORKSPACE_DIRS {
                break;
            }
            if is_plain_dir(&second) {
                dirs.push(second);
            }
        }
    }
    dirs
}

fn relative_label(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn links_outside(root: &Path, canonical_root: &Path, folder: &str) -> Vec<OutsideLink> {
    let own = root.join(folder);
    if is_link(&own) {
        if resolves_inside(&own, canonical_root) {
            return Vec::new();
        }
        return vec![OutsideLink {
            path: own,
            name: folder.to_string(),
            is_folder: true,
        }];
    }
    let mut found = linked_entries_outside(&own, canonical_root, folder);
    if folder != NODE_FOLDER {
        return found;
    }
    for dir in workspace_dirs(root) {
        let nested = dir.join(NODE_FOLDER);
        let label = relative_label(root, &nested);
        if !is_link(&nested) {
            found.extend(linked_entries_outside(&nested, canonical_root, &label));
            continue;
        }
        if !resolves_inside(&nested, canonical_root) {
            found.push(OutsideLink {
                path: nested,
                name: label,
                is_folder: true,
            });
        }
    }
    found
}

fn is_empty_install(folder: &Path) -> bool {
    !entry_paths(folder).iter().any(|path| !is_dotted(path))
}

fn authorize_worktree_with(
    repo_path: &Path,
    worktree_path: &Path,
    run_git: RunGit<'_>,
) -> Result<(), WorktreeError> {
    match inspect_worktree_with(repo_path, worktree_path, run_git) {
        WorktreeInspection::Registered { .. } => Ok(()),
        _ => Err(WorktreeError::Git {
            message: format!(
                "{} is not a worktree of {}",
                worktree_path.display(),
                repo_path.display()
            ),
        }),
    }
}

fn authorize_worktree(repo_path: &str, worktree_path: &str) -> Result<(), WorktreeError> {
    authorize_worktree_with(
        Path::new(repo_path),
        Path::new(worktree_path),
        &mut |cwd, args| git(cwd, args),
    )
}

fn is_directly_inside(link: &Path, canonical_root: &Path) -> bool {
    link.parent()
        .and_then(|parent| std::fs::canonicalize(parent).ok())
        .is_some_and(|parent| parent.starts_with(canonical_root))
}

pub(super) fn deps_check_blocking(worktree_path: String) -> Result<DepsCheck, WorktreeError> {
    let root = Path::new(&worktree_path);
    if !root.is_dir() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let Some(proposal) = setup_proposal_blocking(worktree_path.clone())? else {
        return Ok(not_applicable());
    };
    if !needs_dependencies(root, &proposal.source) {
        return Ok(not_applicable());
    }
    let folder = folder_of(&proposal.source);
    let canonical_root = root.canonicalize()?;
    let target = root.join(folder);
    let outside = links_outside(root, &canonical_root, folder);
    let is_folder_link = outside
        .iter()
        .any(|link| link.is_folder && link.path == target);
    let is_absent = std::fs::symlink_metadata(&target).is_err()
        || (!is_link(&target) && is_empty_install(&target));
    let state = match (outside.is_empty(), is_absent) {
        (false, _) => DepsState::Outside,
        (true, true) => DepsState::Missing,
        (true, false) => DepsState::Ready,
    };
    Ok(DepsCheck {
        state,
        command: Some(install_command(&proposal.command)),
        source: Some(proposal.source),
        folder: Some(folder.to_string()),
        is_folder_link,
        outside: outside
            .into_iter()
            .take(MAX_NAMES)
            .map(|link| link.name)
            .collect(),
    })
}

pub(super) fn deps_unlink_blocking(worktree_path: String) -> Result<Vec<String>, WorktreeError> {
    let root = Path::new(&worktree_path);
    if !root.is_dir() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let Some(proposal) = setup_proposal_blocking(worktree_path.clone())? else {
        return Ok(Vec::new());
    };
    let canonical_root = root.canonicalize()?;
    let mut removed = Vec::new();
    for link in links_outside(root, &canonical_root, folder_of(&proposal.source)) {
        if !link.is_folder
            || !is_link(&link.path)
            || !is_directly_inside(&link.path, &canonical_root)
        {
            continue;
        }
        std::fs::remove_file(&link.path).or_else(|_| std::fs::remove_dir(&link.path))?;
        removed.push(link.name);
    }
    Ok(removed)
}

#[tauri::command]
pub async fn worktree_deps_check(
    repo_path: String,
    worktree_path: String,
) -> Result<DepsCheck, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        authorize_worktree(&repo_path, &worktree_path)?;
        deps_check_blocking(worktree_path)
    })
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn worktree_deps_unlink(
    repo_path: String,
    worktree_path: String,
) -> Result<Vec<String>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        authorize_worktree(&repo_path, &worktree_path)?;
        deps_unlink_blocking(worktree_path)
    })
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
