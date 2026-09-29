use super::error::WorktreeError;
use super::git::{git, RunGit};
use super::types::{WorktreeInfo, WorktreeInspection};
use std::path::{Path, PathBuf};

#[derive(Debug)]
struct RegisteredWorktree {
    path: String,
    is_main: bool,
    is_locked: bool,
    lock_reason: Option<String>,
}

fn registered_worktrees_with(
    repo_path: &Path,
    run_git: RunGit<'_>,
) -> Result<Vec<RegisteredWorktree>, WorktreeError> {
    let output = run_git(repo_path, &["worktree", "list", "--porcelain"])?;
    Ok(parse_registered_worktrees(&output))
}

pub(crate) fn canonical_path(path: &Path) -> Option<PathBuf> {
    std::fs::canonicalize(path).ok()
}

pub(super) fn common_git_dir_with(path: &Path, run_git: RunGit<'_>) -> Option<PathBuf> {
    let raw = run_git(path, &["rev-parse", "--git-common-dir"]).ok()?;
    let value = PathBuf::from(raw.trim());
    let resolved = match value.is_absolute() {
        true => value,
        false => path.join(value),
    };
    canonical_path(&resolved)
}

fn repository_top_level_with(path: &Path, run_git: RunGit<'_>) -> Option<PathBuf> {
    let raw = run_git(path, &["rev-parse", "--show-toplevel"]).ok()?;
    canonical_path(Path::new(raw.trim()))
}

pub(super) fn inspect_worktree_with(
    repo_path: &Path,
    worktree_path: &Path,
    run_git: RunGit<'_>,
) -> WorktreeInspection {
    let requested_path = worktree_path.to_string_lossy().into_owned();
    if !repo_path.is_dir() || canonical_path(repo_path).is_none() {
        return WorktreeInspection::RepositoryUnavailable {
            path: requested_path,
        };
    }
    let registered = match registered_worktrees_with(repo_path, run_git) {
        Ok(found) => found,
        Err(_) => {
            return WorktreeInspection::RepositoryUnavailable {
                path: requested_path,
            };
        }
    };
    let Some(repository_common) = common_git_dir_with(repo_path, run_git) else {
        return WorktreeInspection::RepositoryUnavailable {
            path: requested_path,
        };
    };
    if !worktree_path.exists() {
        return WorktreeInspection::Missing {
            path: requested_path,
        };
    }
    let Some(target) = canonical_path(worktree_path) else {
        return WorktreeInspection::ForeignDirectory {
            path: requested_path,
        };
    };
    let target_key = target.to_string_lossy().into_owned();
    for entry in registered {
        let Some(entry_path) = canonical_path(Path::new(&entry.path)) else {
            continue;
        };
        if entry_path != target {
            continue;
        }
        if repository_top_level_with(&target, run_git) != Some(target.clone()) {
            return WorktreeInspection::ForeignDirectory { path: target_key };
        }
        if common_git_dir_with(&target, run_git) != Some(repository_common.clone()) {
            return WorktreeInspection::ForeignDirectory { path: target_key };
        }
        return WorktreeInspection::Registered {
            path: target_key,
            is_main: entry.is_main,
            is_locked: entry.is_locked,
            lock_reason: entry.lock_reason,
        };
    }
    WorktreeInspection::ForeignDirectory { path: target_key }
}

#[tauri::command]
pub async fn worktree_inspect(
    repo_path: String,
    worktree_path: String,
) -> Result<WorktreeInspection, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(inspect_worktree_with(
            Path::new(&repo_path),
            Path::new(&worktree_path),
            &mut |cwd, args| git(cwd, args),
        ))
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn worktree_git_common_dir(repo_path: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        common_git_dir_with(Path::new(&repo_path), &mut |cwd, args| git(cwd, args))
            .map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .ok()
    .flatten()
}

#[tauri::command]
pub async fn worktree_remote_url(repo_path: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || worktree_remote_url_blocking(repo_path))
        .await
        .unwrap_or(None)
}

fn worktree_remote_url_blocking(repo_path: String) -> Option<String> {
    git(Path::new(&repo_path), &["remote", "get-url", "origin"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

pub(crate) fn parse_porcelain(stdout: &str) -> Vec<WorktreeInfo> {
    let mut entries = Vec::new();
    let mut is_first = true;

    for block in stdout.split("\n\n") {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        let mut path = String::new();
        let mut branch: Option<String> = None;
        let mut head = String::new();

        for line in block.lines() {
            if let Some(rest) = line.strip_prefix("worktree ") {
                path = rest.to_string();
            } else if let Some(rest) = line.strip_prefix("HEAD ") {
                head = rest.to_string();
            } else if let Some(rest) = line.strip_prefix("branch ") {
                branch = Some(rest.strip_prefix("refs/heads/").unwrap_or(rest).to_string());
            } else if line == "detached" {
                branch = None;
            }
        }

        if !path.is_empty() {
            entries.push(WorktreeInfo {
                path,
                branch,
                head,
                is_main: is_first,
            });
            is_first = false;
        }
    }

    entries
}

fn parse_registered_worktrees(stdout: &str) -> Vec<RegisteredWorktree> {
    let mut entries = Vec::new();
    let mut is_main = true;
    for block in stdout.split("\n\n") {
        let mut path = None;
        let mut is_locked = false;
        let mut lock_reason = None;
        for line in block.lines() {
            if let Some(found) = line.strip_prefix("worktree ") {
                path = Some(found.to_string());
                continue;
            }
            if line == "locked" {
                is_locked = true;
                continue;
            }
            if let Some(found) = line.strip_prefix("locked ") {
                is_locked = true;
                lock_reason = Some(found.to_string());
            }
        }
        let Some(path) = path else {
            continue;
        };
        entries.push(RegisteredWorktree {
            path,
            is_main,
            is_locked,
            lock_reason,
        });
        is_main = false;
    }
    entries
}

#[cfg(test)]
mod tests;
