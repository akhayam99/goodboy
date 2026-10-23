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
#[serde(rename_all = "camelCase")]
pub struct RebaseStep {
    pub is_in_progress: bool,
}

fn unmerged_paths(p: &Path) -> Result<Vec<String>, WorktreeError> {
    let raw = git(p, &["diff", "--name-only", "--diff-filter=U"])?;
    Ok(raw
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect())
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RebaseConflictFile {
    pub path: String,
    pub has_markers: bool,
    pub is_stage_only: bool,
}

fn is_regular_blob(mode: &str) -> bool {
    mode == "100644" || mode == "100755"
}

fn is_text_merge(p: &Path, path: &str) -> bool {
    let Ok(raw) = git(p, &["ls-files", "-u", "-z", "--", path]) else {
        return false;
    };
    let mut ours = None;
    let mut theirs = None;
    for entry in raw.split('\0') {
        let Some((meta, _)) = entry.split_once('\t') else {
            continue;
        };
        let fields: Vec<&str> = meta.split(' ').collect();
        let [mode, sha, stage] = fields[..] else {
            continue;
        };
        if !is_regular_blob(mode) {
            return false;
        }
        match stage {
            "2" => ours = Some(sha),
            "3" => theirs = Some(sha),
            _ => {}
        }
    }
    let (Some(ours), Some(theirs)) = (ours, theirs) else {
        return false;
    };
    let is_merge_unset = git(p, &["check-attr", "merge", "--", path])
        .map(|line| line.trim_end().ends_with(": unset"))
        .unwrap_or(true);
    if is_merge_unset {
        return false;
    }
    git(p, &["diff", "--numstat", ours, theirs])
        .map(|stat| !stat.starts_with("-\t-\t"))
        .unwrap_or(false)
}

fn has_conflict_markers(file: &Path) -> bool {
    let Ok(bytes) = std::fs::read(file) else {
        return false;
    };
    bytes
        .split(|byte| *byte == b'\n')
        .any(|line| line.starts_with(b"<<<<<<<") || line.starts_with(b">>>>>>>"))
}

fn conflict_files(p: &Path) -> Result<Vec<RebaseConflictFile>, WorktreeError> {
    Ok(unmerged_paths(p)?
        .into_iter()
        .map(|path| RebaseConflictFile {
            has_markers: has_conflict_markers(&p.join(&path)),
            is_stage_only: !is_text_merge(p, &path),
            path,
        })
        .collect())
}

fn rebase_step(p: &Path, args: &[&str]) -> Result<RebaseStep, WorktreeError> {
    let output = Git::new()
        .cwd(p)
        .args(["-c", "core.editor=true"])
        .args(args)
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", "true")
        .batch_auth()
        .output()?;
    if output.success() {
        return Ok(RebaseStep {
            is_in_progress: in_progress_operation(p) == Some(GitOperation::Rebase),
        });
    }
    if in_progress_operation(p) == Some(GitOperation::Rebase) && !unmerged_paths(p)?.is_empty() {
        return Ok(RebaseStep {
            is_in_progress: true,
        });
    }
    Err(WorktreeError::Git {
        message: output.stderr_redacted().trim().to_string(),
    })
}

fn existing_worktree(worktree_path: &str) -> Result<&Path, WorktreeError> {
    let p = Path::new(worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path.to_string()));
    }
    Ok(p)
}

#[tauri::command]
pub async fn worktree_start_rebase(
    worktree_path: String,
    onto: String,
    branch: String,
) -> Result<RebaseStep, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_start_rebase_blocking(&worktree_path, &onto, &branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_start_rebase_blocking(
    worktree_path: &str,
    onto: &str,
    branch: &str,
) -> Result<RebaseStep, WorktreeError> {
    let p = existing_worktree(worktree_path)?;
    let onto = onto.trim();
    if onto.is_empty() || onto.starts_with('-') {
        return Err(WorktreeError::Git {
            message: format!("{onto} is not a branch to rebase on"),
        });
    }
    if in_progress_operation(p).is_some() {
        return Err(WorktreeError::Git {
            message: "another git operation is in progress in this worktree".to_string(),
        });
    }
    let current = current_branch_name(p);
    if current.as_deref() != Some(branch) {
        return Err(WorktreeError::Git {
            message: format!(
                "this worktree is on {}, not {branch}",
                current.as_deref().unwrap_or("no branch")
            ),
        });
    }
    rebase_step(p, &["rebase", onto])
}

#[tauri::command]
pub async fn worktree_continue_rebase(worktree_path: String) -> Result<RebaseStep, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_continue_rebase_blocking(&worktree_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_continue_rebase_blocking(
    worktree_path: &str,
) -> Result<RebaseStep, WorktreeError> {
    let p = existing_worktree(worktree_path)?;
    if in_progress_operation(p) != Some(GitOperation::Rebase) {
        return Err(WorktreeError::Git {
            message: "no rebase is stopped in this worktree".to_string(),
        });
    }
    let files = conflict_files(p)?;
    let left = files
        .iter()
        .filter(|file| file.has_markers || file.is_stage_only)
        .count();
    if left > 0 {
        return Err(WorktreeError::Git {
            message: format!(
                "{left} {} still conflict",
                match left {
                    1 => "file",
                    _ => "files",
                }
            ),
        });
    }
    if !files.is_empty() {
        let mut args = vec!["add", "-A", "--"];
        args.extend(files.iter().map(|file| file.path.as_str()));
        git(p, &args)?;
    }
    rebase_step(p, &["rebase", "--continue"])
}

#[tauri::command]
pub async fn worktree_rebase_conflicts(
    worktree_path: String,
) -> Result<Vec<RebaseConflictFile>, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || worktree_rebase_conflicts_blocking(&worktree_path))
        .await
        .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_rebase_conflicts_blocking(
    worktree_path: &str,
) -> Result<Vec<RebaseConflictFile>, WorktreeError> {
    conflict_files(existing_worktree(worktree_path)?)
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

fn worktree_commit_range_blocking(
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

fn worktree_blame_line_blocking(
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

#[cfg(test)]
mod tests;
