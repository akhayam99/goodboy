use super::error::WorktreeError;
use super::git::git;
use super::inspect::inspect_worktree_with;
use super::types::WorktreeInspection;
use crate::folder_git::is_secret_name;
use serde::Serialize;
use std::path::{Component, Path, PathBuf};

const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;
const MAX_TREE_FILES: usize = 500;
const MAX_TREE_BYTES: u64 = 10 * 1024 * 1024;
const MAX_CANDIDATES: usize = 100;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CarryStatus {
    Copied,
    SkippedExists,
    SkippedNotIgnored,
    SkippedLarge,
    SkippedMissing,
    SkippedUnsafe,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CarryOutcome {
    pub path: String,
    pub status: CarryStatus,
    pub is_secret: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CarryCandidate {
    pub path: String,
    pub is_directory: bool,
    pub is_secret: bool,
    pub size_bytes: Option<u64>,
    pub is_large: bool,
}

fn last_name(path: &Path) -> &str {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
}

fn safe_relative(path: &str) -> Option<PathBuf> {
    let trimmed = path.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }
    let relative = PathBuf::from(trimmed);
    let mut first: Option<String> = None;
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return None;
        };
        let name = name.to_str()?;
        first.get_or_insert_with(|| name.to_string());
    }
    let first = first?;
    if first == ".git" || first == ".goodboy" {
        return None;
    }
    Some(relative)
}

fn is_dependency_path(relative: &Path) -> bool {
    let mut names = relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(name) => name.to_str(),
            _ => None,
        });
    let top_is_reproducible = names
        .next()
        .is_some_and(crate::reproducible_dirs::is_reproducible_at_top);
    top_is_reproducible
        || relative.components().any(|component| match component {
            Component::Normal(name) => name
                .to_str()
                .is_some_and(crate::reproducible_dirs::is_dependency),
            _ => false,
        })
}

fn is_ignored(repo: &Path, relative: &Path) -> bool {
    git(
        repo,
        &["check-ignore", "-q", "--", &relative.to_string_lossy()],
    )
    .is_ok()
}

struct Tree {
    files: Vec<PathBuf>,
    bytes: u64,
    is_large: bool,
}

fn walk_tree(root: &Path) -> Tree {
    let mut tree = Tree {
        files: Vec::new(),
        bytes: 0,
        is_large: false,
    };
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            let name = entry.file_name().to_string_lossy().into_owned();
            if kind.is_symlink() {
                continue;
            }
            if kind.is_dir() {
                if crate::reproducible_dirs::is_dependency(&name) || name == ".git" {
                    tree.is_large = true;
                    continue;
                }
                pending.push(entry.path());
                continue;
            }
            if !kind.is_file() || is_secret_name(&name) {
                continue;
            }
            let size = entry.metadata().map(|meta| meta.len()).unwrap_or(0);
            tree.bytes = tree.bytes.saturating_add(size);
            tree.files.push(entry.path());
            if tree.files.len() > MAX_TREE_FILES || tree.bytes > MAX_TREE_BYTES {
                tree.is_large = true;
                return tree;
            }
        }
    }
    tree
}

fn copy_file(source: &Path, target: &Path) -> std::io::Result<()> {
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(source, target).map(|_| ())
}

fn carry_one(repo: &Path, worktree: &Path, path: &str) -> CarryOutcome {
    let outcome = |status: CarryStatus, is_secret: bool| CarryOutcome {
        path: path.to_string(),
        status,
        is_secret,
    };
    let Some(relative) = safe_relative(path) else {
        return outcome(CarryStatus::SkippedUnsafe, false);
    };
    let is_secret = is_secret_name(last_name(&relative));
    let source = repo.join(&relative);
    let target = worktree.join(&relative);
    let Ok(meta) = std::fs::symlink_metadata(&source) else {
        return outcome(CarryStatus::SkippedMissing, is_secret);
    };
    if meta.file_type().is_symlink() {
        return outcome(CarryStatus::SkippedUnsafe, is_secret);
    }
    if !is_ignored(repo, &relative) {
        return outcome(CarryStatus::SkippedNotIgnored, is_secret);
    }
    if is_dependency_path(&relative) {
        return outcome(CarryStatus::SkippedLarge, is_secret);
    }
    if std::fs::symlink_metadata(&target).is_ok() {
        return outcome(CarryStatus::SkippedExists, is_secret);
    }
    if meta.is_file() {
        if meta.len() > MAX_FILE_BYTES {
            return outcome(CarryStatus::SkippedLarge, is_secret);
        }
        return match copy_file(&source, &target) {
            Ok(()) => outcome(CarryStatus::Copied, is_secret),
            Err(_) => outcome(CarryStatus::SkippedUnsafe, is_secret),
        };
    }
    if !meta.is_dir() {
        return outcome(CarryStatus::SkippedUnsafe, is_secret);
    }
    let tree = walk_tree(&source);
    if tree.is_large {
        return outcome(CarryStatus::SkippedLarge, is_secret);
    }
    for file in &tree.files {
        let Ok(inside) = file.strip_prefix(&source) else {
            continue;
        };
        if copy_file(file, &target.join(inside)).is_err() {
            return outcome(CarryStatus::SkippedUnsafe, is_secret);
        }
    }
    if tree.files.is_empty() {
        let _ = std::fs::create_dir_all(&target);
    }
    outcome(CarryStatus::Copied, is_secret)
}

pub(crate) fn carry_into_worktree(
    repo: &Path,
    worktree: &Path,
    paths: &[String],
) -> Vec<CarryOutcome> {
    let mut seen: Vec<&str> = Vec::new();
    let mut outcomes = Vec::new();
    for path in paths {
        if seen.contains(&path.as_str()) {
            continue;
        }
        seen.push(path.as_str());
        outcomes.push(carry_one(repo, worktree, path));
    }
    outcomes
}

fn candidate_of(repo: &Path, raw: &str) -> Option<CarryCandidate> {
    let is_directory = raw.ends_with('/');
    let path = raw.trim_end_matches('/');
    let relative = safe_relative(path)?;
    let top = relative
        .components()
        .next()
        .and_then(|component| match component {
            Component::Normal(name) => name.to_str(),
            _ => None,
        })?;
    if crate::reproducible_dirs::is_reproducible_at_top(top) {
        return None;
    }
    let source = repo.join(&relative);
    let meta = std::fs::symlink_metadata(&source).ok()?;
    if meta.file_type().is_symlink() {
        return None;
    }
    if is_directory {
        if !is_ignored(repo, &relative) {
            return None;
        }
        let tree = walk_tree(&source);
        return Some(CarryCandidate {
            path: path.to_string(),
            is_directory: true,
            is_secret: false,
            size_bytes: (!tree.is_large).then_some(tree.bytes),
            is_large: tree.is_large,
        });
    }
    Some(CarryCandidate {
        path: path.to_string(),
        is_directory: false,
        is_secret: is_secret_name(last_name(&relative)),
        size_bytes: Some(meta.len()),
        is_large: meta.len() > MAX_FILE_BYTES,
    })
}

pub(super) fn carry_candidates_blocking(
    repo_path: String,
) -> Result<Vec<CarryCandidate>, WorktreeError> {
    let repo = Path::new(&repo_path);
    if !repo.exists() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    let raw = git(
        repo,
        &[
            "ls-files",
            "--others",
            "--ignored",
            "--exclude-standard",
            "--directory",
            "-z",
        ],
    )?;
    let mut candidates: Vec<CarryCandidate> = raw
        .split('\0')
        .filter(|entry| !entry.is_empty())
        .filter_map(|entry| candidate_of(repo, entry))
        .collect();
    candidates.sort_by(|left, right| left.path.cmp(&right.path));
    candidates.truncate(MAX_CANDIDATES);
    Ok(candidates)
}

#[tauri::command]
pub async fn worktree_carry_candidates(
    repo_path: String,
) -> Result<Vec<CarryCandidate>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || carry_candidates_blocking(repo_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn carry_into_blocking(
    repo_path: String,
    worktree_path: String,
    paths: Vec<String>,
) -> Result<Vec<CarryOutcome>, WorktreeError> {
    let repo = Path::new(&repo_path);
    let worktree = Path::new(&worktree_path);
    let inspection = inspect_worktree_with(repo, worktree, &mut |cwd, args| git(cwd, args));
    let WorktreeInspection::Registered {
        path,
        is_main: false,
        ..
    } = inspection
    else {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    };
    Ok(carry_into_worktree(repo, Path::new(&path), &paths))
}

#[tauri::command]
pub async fn worktree_carry_into(
    repo_path: String,
    worktree_path: String,
    paths: Vec<String>,
) -> Result<Vec<CarryOutcome>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        carry_into_blocking(repo_path, worktree_path, paths)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
