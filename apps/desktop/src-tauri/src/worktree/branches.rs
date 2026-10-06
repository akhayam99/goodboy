use super::base::resolve_origin_head;
use super::create::branch_checkout_path_with;
use super::error::WorktreeError;
use super::foreign::{remote_backed_source, switch_to_remote_branch, BranchSource};
use super::git::git;
use super::inspect::{canonical_path, parse_porcelain};
use super::merge_state::{branch_merge_state, BranchMergeState};
use super::types::{BranchInfo, ChangeBranchArgs, ChangedBranch, WorktreeInfo};
use std::path::{Path, PathBuf};

#[tauri::command]
pub async fn worktree_list_local_branches(
    repo_path: String,
) -> Result<Vec<BranchInfo>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || list_local_branches_blocking(repo_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn worktree_list_branch_names(repo_path: String) -> Result<Vec<String>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || list_branch_names_blocking(repo_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn worktree_repo_default_base_branch(
    repo_path: String,
) -> Result<Option<String>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || repo_default_base_branch_blocking(repo_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn repo_default_base_branch_blocking(repo_path: String) -> Result<Option<String>, WorktreeError> {
    let p = Path::new(&repo_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    Ok(resolve_origin_head(p))
}

#[tauri::command]
pub async fn worktree_branch_merge_state(
    repo_path: String,
    branch: String,
    base: Option<String>,
    merged_head: Option<String>,
) -> Result<BranchMergeState, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        branch_merge_state_blocking(repo_path, branch, base, merged_head)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn branch_merge_state_blocking(
    repo_path: String,
    branch: String,
    base: Option<String>,
    merged_head: Option<String>,
) -> Result<BranchMergeState, WorktreeError> {
    let p = Path::new(&repo_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    Ok(branch_merge_state(
        p,
        &branch,
        base.as_deref(),
        merged_head.as_deref(),
    ))
}

fn list_branch_names_blocking(repo_path: String) -> Result<Vec<String>, WorktreeError> {
    let p = Path::new(&repo_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    let raw = git(
        p,
        &[
            "for-each-ref",
            "--format=%(refname:short)",
            "refs/heads",
            "refs/remotes",
        ],
    )?;
    Ok(normalize_branch_names(&raw))
}

fn normalize_branch_names(raw: &str) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut names = Vec::new();
    for line in raw.lines() {
        let name = line.trim();
        if name.is_empty() || name == "origin" || name.ends_with("/HEAD") {
            continue;
        }
        let normalized = name.strip_prefix("origin/").unwrap_or(name);
        if seen.insert(normalized.to_string()) {
            names.push(normalized.to_string());
        }
    }
    names
}

fn list_local_branches_blocking(repo_path: String) -> Result<Vec<BranchInfo>, WorktreeError> {
    let p = Path::new(&repo_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    let raw = git(
        p,
        &["for-each-ref", "--format=%(refname:short)", "refs/heads"],
    )?;
    let worktrees = parse_porcelain(&git(p, &["worktree", "list", "--porcelain"])?);
    let in_use_branches: std::collections::HashSet<String> =
        worktrees.iter().filter_map(|w| w.branch.clone()).collect();
    let uncommitted = uncommitted_status_by_branch(&worktrees, &in_use_branches);
    let mut branches = Vec::new();
    for line in raw.lines() {
        let name = line.trim();
        if name.is_empty() {
            continue;
        }
        let in_use = in_use_branches.contains(name);
        let has_uncommitted = uncommitted.get(name).copied().unwrap_or(false);
        branches.push(BranchInfo {
            name: name.to_string(),
            in_use,
            has_uncommitted,
        });
    }
    Ok(branches)
}

fn uncommitted_status_by_branch(
    worktrees: &[WorktreeInfo],
    in_use_branches: &std::collections::HashSet<String>,
) -> std::collections::HashMap<String, bool> {
    let targets: Vec<(&str, &str)> = worktrees
        .iter()
        .filter_map(|w| {
            let branch = w.branch.as_deref()?;
            in_use_branches
                .contains(branch)
                .then_some((branch, w.path.as_str()))
        })
        .collect();
    std::thread::scope(|scope| {
        targets
            .iter()
            .map(|(branch, path)| (*branch, scope.spawn(move || worktree_has_uncommitted(path))))
            .collect::<Vec<_>>()
            .into_iter()
            .map(|(branch, handle)| (branch.to_string(), handle.join().unwrap_or(false)))
            .collect()
    })
}

fn worktree_has_uncommitted(path: &str) -> bool {
    git(Path::new(path), &["status", "--porcelain"])
        .map(|out| !out.trim().is_empty())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn worktree_change_branch(
    args: ChangeBranchArgs,
) -> Result<ChangedBranch, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_change_branch_blocking(args))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_change_branch_blocking(
    args: ChangeBranchArgs,
) -> Result<ChangedBranch, WorktreeError> {
    let wt = Path::new(&args.worktree_path);
    if !wt.exists() {
        return Err(WorktreeError::RepoNotFound(args.worktree_path.clone()));
    }
    let trimmed = args.branch.trim();
    if trimmed.is_empty() {
        return Err(WorktreeError::Git {
            message: "branch name is empty".to_string(),
        });
    }
    if trimmed.starts_with('-') {
        return Err(WorktreeError::Git {
            message: "branch name cannot start with '-'".to_string(),
        });
    }
    let repo_path = PathBuf::from(&args.repo_path);
    if args.create_new {
        return match remote_backed_source(&repo_path, trimmed)? {
            Some(BranchSource::RemoteOnly) => {
                git(
                    wt,
                    &[
                        "switch",
                        "--track",
                        "-c",
                        trimmed,
                        &format!("origin/{trimmed}"),
                    ],
                )?;
                Ok(ChangedBranch { adopted: true })
            }
            Some(_) => switch_to_existing(&repo_path, wt, trimmed),
            None => {
                git(wt, &["switch", "-c", trimmed])?;
                Ok(ChangedBranch { adopted: false })
            }
        };
    }
    switch_to_existing(&repo_path, wt, trimmed)
}

fn switch_to_existing(
    repo_path: &Path,
    wt: &Path,
    trimmed: &str,
) -> Result<ChangedBranch, WorktreeError> {
    if let Some(holder) =
        branch_checkout_path_with(repo_path, trimmed, &mut |cwd, args| git(cwd, args))
    {
        if !is_same_directory(Path::new(&holder), wt) {
            return Err(WorktreeError::BranchInUse {
                branch: trimmed.to_string(),
                path: holder,
            });
        }
    }
    if switch_to_remote_branch(repo_path, wt, trimmed)? {
        return Ok(ChangedBranch { adopted: true });
    }
    git(wt, &["switch", trimmed])?;
    Ok(ChangedBranch { adopted: true })
}

fn is_same_directory(left: &Path, right: &Path) -> bool {
    match (canonical_path(left), canonical_path(right)) {
        (Some(one), Some(other)) => one == other,
        _ => left == right,
    }
}

#[tauri::command]
pub async fn worktree_branch_holder(
    repo_path: String,
    branch: String,
) -> Result<Option<String>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_branch_holder_blocking(repo_path, branch))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_branch_holder_blocking(
    repo_path: String,
    branch: String,
) -> Result<Option<String>, WorktreeError> {
    let repo = PathBuf::from(&repo_path);
    if !repo.exists() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    let trimmed = branch.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    Ok(branch_checkout_path_with(
        &repo,
        trimmed,
        &mut |cwd, args| git(cwd, args),
    ))
}

#[cfg(test)]
mod tests;
