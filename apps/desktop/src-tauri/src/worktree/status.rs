use super::base::{base_candidates, normalized_base};
use super::error::WorktreeError;
use super::git::git;
use super::types::{GitDistance, GitOperation, GitUnknownReason, GitWorkingTree, WorktreeStatus};
use std::path::{Path, PathBuf};

#[tauri::command]
pub async fn worktree_status(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<WorktreeStatus, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        worktree_status_blocking(worktree_path, base_branch)
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

pub(super) fn worktree_status_blocking(
    worktree_path: String,
    base_branch: Option<String>,
) -> Result<WorktreeStatus, WorktreeError> {
    let p = Path::new(&worktree_path);
    if !p.exists() {
        return Err(WorktreeError::RepoNotFound(worktree_path));
    }
    let snapshot = git(p, &["status", "--porcelain=v2", "--branch"])
        .ok()
        .map(|raw| parse_status_v2(&raw));
    let branch = snapshot.as_ref().and_then(|s| s.branch.clone());
    let head = snapshot.as_ref().and_then(|s| s.head.clone());
    let head_subject = git(p, &["log", "-1", "--format=%s"])
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let remote = snapshot.as_ref().map(|found| {
        crate::branch_remote::branch_remote(
            p,
            branch.as_deref(),
            found
                .upstream
                .as_deref()
                .map(|name| crate::branch_remote::ConfiguredUpstream {
                    name,
                    distance: found.upstream_ab,
                }),
        )
    });
    let (upstream, upstream_distance) = match remote {
        None => (
            None,
            GitDistance::Unknown {
                reason: GitUnknownReason::StatusReadFailed,
            },
        ),
        Some(found) => (found.tracking, found.distance),
    };
    let working_tree = snapshot
        .map(|s| s.working_tree)
        .unwrap_or(GitWorkingTree::Unknown {
            reason: GitUnknownReason::StatusReadFailed,
        });
    let configured_base = normalized_base(base_branch.as_deref());
    Ok(WorktreeStatus {
        branch,
        head,
        head_subject,
        upstream_distance,
        main_distance: base_distance(p, configured_base),
        working_tree,
        upstream,
        in_progress: in_progress_operation(p),
    })
}

#[derive(Debug, PartialEq, Eq)]
pub(super) struct StatusSnapshot {
    pub(super) branch: Option<String>,
    pub(super) head: Option<String>,
    pub(super) upstream: Option<String>,
    pub(super) upstream_ab: Option<(u32, u32)>,
    pub(super) working_tree: GitWorkingTree,
}

fn parse_ab(value: &str) -> Option<(u32, u32)> {
    let mut ahead = None;
    let mut behind = None;
    for part in value.split_whitespace() {
        if let Some(count) = part.strip_prefix('+') {
            ahead = count.parse::<u32>().ok();
        } else if let Some(count) = part.strip_prefix('-') {
            behind = count.parse::<u32>().ok();
        }
    }
    Some((ahead?, behind?))
}

pub(super) fn parse_status_v2(raw: &str) -> StatusSnapshot {
    let mut branch = None;
    let mut head = None;
    let mut upstream = None;
    let mut upstream_ab = None;
    let mut staged = 0u32;
    let mut unstaged = 0u32;
    let mut untracked = 0u32;
    let mut unmerged = 0u32;
    let mut changed = 0u32;
    for line in raw.lines() {
        if let Some(header) = line.strip_prefix("# ") {
            let (key, value) = header.split_once(' ').unwrap_or((header, ""));
            match key {
                "branch.oid" if value != "(initial)" => head = Some(value.to_string()),
                "branch.head" if value != "(detached)" => branch = Some(value.to_string()),
                "branch.upstream" => upstream = Some(value.to_string()),
                "branch.ab" => upstream_ab = parse_ab(value),
                _ => {}
            }
            continue;
        }
        let mut fields = line.split(' ');
        let Some(kind) = fields.next() else {
            continue;
        };
        match kind {
            "1" | "2" => {
                changed += 1;
                let xy = fields.next().unwrap_or("..").as_bytes();
                if xy.first().is_some_and(|x| *x != b'.') {
                    staged += 1;
                }
                if xy.get(1).is_some_and(|y| *y != b'.') {
                    unstaged += 1;
                }
            }
            "u" => {
                changed += 1;
                unmerged += 1;
            }
            "?" => {
                changed += 1;
                untracked += 1;
            }
            _ => {}
        }
    }
    StatusSnapshot {
        branch,
        head,
        upstream,
        upstream_ab,
        working_tree: GitWorkingTree::Known {
            staged,
            unstaged,
            untracked,
            unmerged,
            changed,
        },
    }
}

fn base_distance(cwd: &Path, configured_base: Option<&str>) -> GitDistance {
    for base_ref in base_candidates(cwd, configured_base) {
        if let Some((ahead, behind)) = rev_list_left_right(cwd, &base_ref, "HEAD") {
            return GitDistance::Known { ahead, behind };
        }
    }
    GitDistance::Unknown {
        reason: GitUnknownReason::MainRefUnresolved,
    }
}

pub(super) fn operation_label(operation: GitOperation) -> &'static str {
    match operation {
        GitOperation::Merge => "merge",
        GitOperation::Rebase => "rebase",
        GitOperation::CherryPick => "cherry-pick",
        GitOperation::Bisect => "bisect",
    }
}

pub(crate) fn current_branch_name(cwd: &Path) -> Option<String> {
    git(cwd, &["symbolic-ref", "--quiet", "--short", "HEAD"])
        .ok()
        .map(|found| found.trim().to_string())
        .filter(|found| !found.is_empty())
}

pub(crate) fn resolve_upstream(cwd: &Path) -> Option<String> {
    git(
        cwd,
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    )
    .ok()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
}

pub(crate) fn rev_list_left_right(cwd: &Path, left: &str, right: &str) -> Option<(u32, u32)> {
    let out = git(
        cwd,
        &[
            "rev-list",
            "--left-right",
            "--count",
            &format!("{left}...{right}"),
        ],
    )
    .ok()?;
    let parts: Vec<&str> = out.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }
    let behind = parts[0].parse::<u32>().ok()?;
    let ahead = parts[1].parse::<u32>().ok()?;
    Some((ahead, behind))
}

pub(crate) fn distance_between(cwd: &Path, left: &str, right: &str) -> GitDistance {
    match rev_list_left_right(cwd, left, right) {
        Some((ahead, behind)) => GitDistance::Known { ahead, behind },
        None => GitDistance::Unknown {
            reason: GitUnknownReason::RevListFailed,
        },
    }
}

pub(crate) fn read_working_tree(cwd: &Path) -> GitWorkingTree {
    let raw = match git(cwd, &["status", "--porcelain=v1"]) {
        Ok(s) => s,
        Err(_) => {
            return GitWorkingTree::Unknown {
                reason: GitUnknownReason::StatusReadFailed,
            };
        }
    };
    parse_working_tree(&raw)
}

pub(crate) fn parse_working_tree(raw: &str) -> GitWorkingTree {
    let mut staged = 0u32;
    let mut unstaged = 0u32;
    let mut untracked = 0u32;
    let mut unmerged = 0u32;
    let mut changed = 0u32;
    for line in raw.lines() {
        let bytes = line.as_bytes();
        if bytes.len() < 2 {
            continue;
        }
        changed += 1;
        let x = bytes[0] as char;
        let y = bytes[1] as char;
        if x == '?' && y == '?' {
            untracked += 1;
            continue;
        }
        if x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D') {
            unmerged += 1;
            continue;
        }
        if x != ' ' && x != '?' {
            staged += 1;
        }
        if y != ' ' && y != '?' {
            unstaged += 1;
        }
    }
    GitWorkingTree::Known {
        staged,
        unstaged,
        untracked,
        unmerged,
        changed,
    }
}

pub(crate) fn git_dir_of(cwd: &Path) -> Option<PathBuf> {
    let dot_git = cwd.join(".git");
    if dot_git.is_dir() {
        return Some(dot_git);
    }
    let pointed = std::fs::read_to_string(&dot_git)
        .ok()
        .and_then(|pointer| Some(pointer.trim().strip_prefix("gitdir:")?.trim().to_string()))
        .map(|target| match Path::new(&target).is_absolute() {
            true => PathBuf::from(target),
            false => cwd.join(target),
        })
        .filter(|resolved| resolved.is_dir());
    if let Some(resolved) = pointed {
        return Some(resolved);
    }
    git(cwd, &["rev-parse", "--absolute-git-dir"])
        .ok()
        .map(|found| PathBuf::from(found.trim()))
}

pub(crate) fn in_progress_operation(cwd: &Path) -> Option<GitOperation> {
    let git_dir = git_dir_of(cwd)?;
    if git_dir.join("MERGE_HEAD").is_file() {
        return Some(GitOperation::Merge);
    }
    if git_dir.join("rebase-merge").is_dir() || git_dir.join("rebase-apply").is_dir() {
        return Some(GitOperation::Rebase);
    }
    if git_dir.join("CHERRY_PICK_HEAD").is_file() {
        return Some(GitOperation::CherryPick);
    }
    if git_dir.join("BISECT_LOG").is_file() {
        return Some(GitOperation::Bisect);
    }
    None
}

#[cfg(test)]
mod tests;
