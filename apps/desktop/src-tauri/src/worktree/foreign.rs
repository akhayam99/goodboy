use super::base::resolve_base_ref;
use super::create::{branch_checkout_path_with, try_fetch_origin};
use super::error::WorktreeError;
use super::git::{git, is_ancestor};
use super::types::{RemoteBranchInfo, RemoteBranchState};
use std::collections::HashSet;
use std::path::Path;

#[derive(Debug, PartialEq, Eq)]
pub(super) enum BranchSource {
    Absent,
    LocalOnly,
    RemoteOnly,
    Same,
    Differs,
}

fn ref_sha(repo_path: &Path, reference: &str) -> Option<String> {
    git(repo_path, &["rev-parse", "--verify", "--quiet", reference])
        .ok()
        .map(|raw| raw.trim().to_string())
        .filter(|sha| !sha.is_empty())
}

pub(super) fn branch_source(repo_path: &Path, name: &str) -> BranchSource {
    let local = ref_sha(repo_path, &format!("refs/heads/{name}"));
    let remote = ref_sha(repo_path, &format!("refs/remotes/origin/{name}"));
    match (local, remote) {
        (None, None) => BranchSource::Absent,
        (Some(_), None) => BranchSource::LocalOnly,
        (None, Some(_)) => BranchSource::RemoteOnly,
        (Some(local), Some(remote)) if local == remote => BranchSource::Same,
        _ => BranchSource::Differs,
    }
}

pub(super) fn remote_backed_source(
    repo_path: &Path,
    name: &str,
) -> Result<Option<BranchSource>, WorktreeError> {
    let _ = try_fetch_origin(repo_path, name);
    match branch_source(repo_path, name) {
        BranchSource::Differs => Err(WorktreeError::LocalBranchDiffers {
            branch: name.to_string(),
        }),
        source @ (BranchSource::RemoteOnly | BranchSource::Same) => Ok(Some(source)),
        BranchSource::Absent | BranchSource::LocalOnly => Ok(None),
    }
}

pub(super) fn add_remote_backed_worktree(
    repo_path: &Path,
    worktree_path: &Path,
    name: &str,
    source: &BranchSource,
) -> Result<(), WorktreeError> {
    let target = worktree_path.to_string_lossy();
    if *source == BranchSource::Same {
        if let Some(holder) =
            branch_checkout_path_with(repo_path, name, &mut |cwd, args| git(cwd, args))
        {
            return Err(WorktreeError::BranchInUse {
                branch: name.to_string(),
                path: holder,
            });
        }
        git(repo_path, &["worktree", "add", target.as_ref(), name])?;
        return Ok(());
    }
    git(
        repo_path,
        &[
            "worktree",
            "add",
            "--track",
            "-b",
            name,
            target.as_ref(),
            &format!("origin/{name}"),
        ],
    )?;
    Ok(())
}

pub(super) fn switch_to_remote_branch(
    repo_path: &Path,
    worktree_path: &Path,
    name: &str,
) -> Result<bool, WorktreeError> {
    if ref_sha(repo_path, &format!("refs/heads/{name}")).is_some() {
        return Ok(false);
    }
    let _ = try_fetch_origin(repo_path, name);
    if branch_source(repo_path, name) != BranchSource::RemoteOnly {
        return Ok(false);
    }
    git(
        worktree_path,
        &["switch", "--track", "-c", name, &format!("origin/{name}")],
    )?;
    Ok(true)
}

#[tauri::command]
pub async fn worktree_list_remote_branches(
    repo_path: String,
) -> Result<Vec<RemoteBranchInfo>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || list_remote_branches_blocking(repo_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn list_remote_branches_blocking(
    repo_path: String,
) -> Result<Vec<RemoteBranchInfo>, WorktreeError> {
    let repo = Path::new(&repo_path);
    if !repo.exists() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    let locals: HashSet<String> = git(
        repo,
        &["for-each-ref", "--format=%(refname:short)", "refs/heads"],
    )?
    .lines()
    .map(|line| line.trim().to_string())
    .filter(|line| !line.is_empty())
    .collect();
    let raw = git(
        repo,
        &[
            "for-each-ref",
            "--sort=-committerdate",
            "--format=%(refname:lstrip=3)%1f%(authorname)%1f%(objectname)%1f%(committerdate:unix)",
            "refs/remotes/origin",
        ],
    )?;
    let mut branches = Vec::new();
    for line in raw.lines() {
        let mut parts = line.split('\u{1f}');
        let (Some(name), Some(author), Some(sha), Some(stamp)) =
            (parts.next(), parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        if name.is_empty() || name == "HEAD" {
            continue;
        }
        branches.push(RemoteBranchInfo {
            name: name.to_string(),
            author: author.to_string(),
            sha: sha.to_string(),
            timestamp: stamp.trim().parse().unwrap_or(0),
            has_local: locals.contains(name),
        });
    }
    Ok(branches)
}

#[tauri::command]
pub async fn worktree_fetch_remote_branches(repo_path: String) -> Result<(), WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let repo = Path::new(&repo_path);
        if !repo.exists() {
            return Err(WorktreeError::RepoNotFound(repo_path));
        }
        git(repo, &["fetch", "--prune", "origin"])?;
        Ok(())
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn count_commits(repo_path: &Path, range: &str) -> u32 {
    git(repo_path, &["rev-list", "--count", range])
        .ok()
        .and_then(|raw| raw.trim().parse().ok())
        .unwrap_or(0)
}

#[tauri::command]
pub async fn worktree_remote_branch_state(
    repo_path: String,
    branch: String,
    base: Option<String>,
) -> Result<Option<RemoteBranchState>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        remote_branch_state_blocking(repo_path, branch, base)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn remote_branch_state_blocking(
    repo_path: String,
    branch: String,
    base: Option<String>,
) -> Result<Option<RemoteBranchState>, WorktreeError> {
    let repo = Path::new(&repo_path);
    if !repo.exists() {
        return Err(WorktreeError::RepoNotFound(repo_path));
    }
    let _ = try_fetch_origin(repo, &branch);
    let remote_ref = format!("refs/remotes/origin/{branch}");
    let local_ref = format!("refs/heads/{branch}");
    let (Some(remote_sha), Some(local_sha)) =
        (ref_sha(repo, &remote_ref), ref_sha(repo, &local_ref))
    else {
        return Ok(None);
    };
    let Some(base_ref) = resolve_base_ref(repo, base.as_deref()) else {
        return Ok(None);
    };
    Ok(Some(RemoteBranchState {
        remote_ahead: count_commits(repo, &format!("{base_ref}..{remote_ref}")),
        local_own: count_commits(repo, &format!("{base_ref}..{local_ref}")),
        remote_contains_local: is_ancestor(repo, &local_sha, &remote_sha),
        remote_sha,
        local_sha,
    }))
}

#[tauri::command]
pub async fn worktree_use_remote_commits(
    worktree_path: String,
    branch: String,
) -> Result<(), WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || use_remote_commits_blocking(worktree_path, branch))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn use_remote_commits_blocking(
    worktree_path: String,
    branch: String,
) -> Result<(), WorktreeError> {
    let wt = Path::new(&worktree_path);
    if !wt.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let current = git(wt, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    if current.trim() != branch {
        return Err(WorktreeError::Git {
            message: format!("this worktree is not on {branch}"),
        });
    }
    let status = git(wt, &["status", "--porcelain"])?;
    if !status.trim().is_empty() {
        return Err(WorktreeError::Git {
            message: "the worktree has uncommitted changes. commit or discard them first"
                .to_string(),
        });
    }
    let _ = try_fetch_origin(wt, &branch);
    let remote_ref = format!("refs/remotes/origin/{branch}");
    let (Some(remote_sha), Some(local_sha)) = (ref_sha(wt, &remote_ref), ref_sha(wt, "HEAD"))
    else {
        return Err(WorktreeError::BranchNotFound { branch });
    };
    if !is_ancestor(wt, &local_sha, &remote_sha) {
        return Err(WorktreeError::LocalBranchDiffers { branch });
    }
    git(wt, &["merge", "--ff-only", &format!("origin/{branch}")])?;
    git(
        wt,
        &[
            "branch",
            &format!("--set-upstream-to=origin/{branch}"),
            &branch,
        ],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests;
