use super::base::resolve_branch_range;
use super::error::WorktreeError;
use super::git::{git, git_strs, rev_list_set};
use super::status::{current_branch_name, in_progress_operation, resolve_upstream};
use super::types::{BranchCommit, GitDistance, GitOperation};
use crate::proc::git::Git;
use serde::Serialize;
use std::path::Path;

const COMMIT_LIMIT: usize = 100;

const COMMIT_FORMAT: &str = "%H%x1f%h%x1f%s%x1f%an%x1f%at%x1f%P";

#[tauri::command]
pub async fn worktree_commits(worktree_path: String) -> Result<Vec<BranchCommit>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_commits_blocking(worktree_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_commits_blocking(
    worktree_path: String,
) -> Result<Vec<BranchCommit>, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let configured = resolve_upstream(p);
    let remote = crate::branch_remote::branch_remote(
        p,
        current_branch_name(p).as_deref(),
        configured
            .as_deref()
            .map(|name| crate::branch_remote::ConfiguredUpstream {
                name,
                distance: None,
            }),
    );
    let tracking = match remote.distance {
        GitDistance::Known { .. } => remote.tracking,
        GitDistance::Unknown { .. } => None,
    };
    let unpushed = if let Some(ref upstream) = tracking {
        rev_list_set(p, &format!("refs/remotes/{upstream}..HEAD"))
    } else {
        rev_list_set(p, "HEAD")
            .into_iter()
            .take(COMMIT_LIMIT)
            .collect()
    };

    let branch_range = resolve_branch_range(p);
    let log_args: Vec<String> = vec![
        "log".to_string(),
        format!("-n{COMMIT_LIMIT}"),
        format!("--format={COMMIT_FORMAT}"),
        branch_range,
    ];
    let raw = git_strs(p, &log_args)?;
    let mut commits = Vec::new();
    for line in raw.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('\u{1f}').collect();
        if parts.len() < 6 {
            continue;
        }
        let sha = parts[0].to_string();
        let parents: Vec<&str> = parts[5].split_whitespace().collect();
        let parent_sha = parents.first().map(|s| s.to_string());
        let pushed = !unpushed.contains(&sha);
        let timestamp = parts[4].parse::<i64>().unwrap_or(0);
        commits.push(BranchCommit {
            sha,
            short_sha: parts[1].to_string(),
            subject: parts[2].to_string(),
            author: parts[3].to_string(),
            timestamp,
            pushed,
            parent_sha,
        });
    }
    Ok(commits)
}

#[tauri::command]
pub async fn worktree_is_ancestor(
    worktree_path: String,
    sha: String,
    head: String,
) -> Result<bool, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_is_ancestor_blocking(worktree_path, sha, head)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_is_ancestor_blocking(
    worktree_path: String,
    sha: String,
    head: String,
) -> Result<bool, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let output = Git::new()
        .args(["merge-base", "--is-ancestor", &sha, &head])
        .cwd(p)
        .output()?;
    Ok(output.success())
}

#[tauri::command]
pub async fn worktree_abort_rebase(worktree_path: String) -> Result<(), WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_abort_rebase_blocking(&worktree_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_abort_rebase_blocking(worktree_path: &str) -> Result<(), WorktreeError> {
    let p = Path::new(worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path.to_string()));
    }
    if in_progress_operation(p) != Some(GitOperation::Rebase) {
        return Err(WorktreeError::Git {
            message: "no rebase is stopped in this worktree".to_string(),
        });
    }
    git(p, &["rebase", "--abort"]).map(|_| ())
}

#[derive(Debug, Serialize, PartialEq)]
pub struct RangeCommit {
    pub sha: String,
    pub subject: String,
}

#[tauri::command]
pub async fn worktree_commit_range(
    worktree_path: String,
    base: String,
    head: String,
) -> Result<Vec<RangeCommit>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_commit_range_blocking(worktree_path, base, head)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_commit_range_blocking(
    worktree_path: String,
    base: String,
    head: String,
) -> Result<Vec<RangeCommit>, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let range = format!("{base}..{head}");
    let raw = git(p, &["log", "--reverse", "--format=%H%x1f%s", &range])?;
    Ok(raw
        .lines()
        .filter_map(|line| {
            let (sha, subject) = line.split_once('\u{1f}')?;
            Some(RangeCommit {
                sha: sha.to_string(),
                subject: subject.to_string(),
            })
        })
        .collect())
}

#[tauri::command]
pub async fn worktree_blame_line(
    worktree_path: String,
    path: String,
    line: u32,
) -> Result<Option<String>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_blame_line_blocking(worktree_path, path, line)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_blame_line_blocking(
    worktree_path: String,
    path: String,
    line: u32,
) -> Result<Option<String>, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    if line == 0 {
        return Ok(None);
    }
    let span = format!("{line},{line}");
    let Ok(raw) = git(
        p,
        &["blame", "--porcelain", "-L", &span, "HEAD", "--", &path],
    ) else {
        return Ok(None);
    };
    let sha = raw
        .split_whitespace()
        .next()
        .filter(|sha| sha.len() >= 40 && sha.chars().any(|c| c != '0'))
        .map(str::to_string);
    Ok(sha)
}

#[tauri::command]
pub async fn worktree_remote_head(
    worktree_path: String,
    branch: String,
) -> Result<Option<String>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_remote_head_blocking(worktree_path, branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn worktree_remote_head_blocking(
    worktree_path: String,
    branch: String,
) -> Result<Option<String>, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let reference = format!("refs/heads/{branch}");
    let raw = git(p, &["ls-remote", "origin", &reference])?;
    Ok(raw
        .lines()
        .find_map(|line| line.split_whitespace().next())
        .map(|sha| sha.to_string()))
}
