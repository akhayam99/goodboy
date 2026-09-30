use super::error::WorktreeError;
use super::git::{git, RunGit};
use super::inspect::{common_git_dir_with, inspect_worktree_with};
use super::status::{in_progress_operation, parse_working_tree};
use super::types::{
    GitWorkingTree, WorktreeInspection, WorktreeRemovalMode, WorktreeRemovalReason,
    WorktreeRemovalResult,
};
use std::path::{Path, PathBuf};

const REMOVE_RETRY_DELAY: std::time::Duration = std::time::Duration::from_millis(300);

fn is_directory_not_empty(error: &WorktreeError) -> bool {
    let WorktreeError::Git { message } = error else {
        return false;
    };
    let lowered = message.to_ascii_lowercase();
    lowered.contains("directory not empty") || lowered.contains("failed to delete")
}

pub(super) fn foreign_directory_reason_with(
    repo_path: &Path,
    target_path: &Path,
    run_git: RunGit<'_>,
) -> WorktreeRemovalReason {
    let repository_common = common_git_dir_with(repo_path, run_git);
    let target_common = common_git_dir_with(target_path, run_git);
    if repository_common.is_some() && target_common.is_some() && repository_common != target_common
    {
        return WorktreeRemovalReason::DifferentRepository;
    }
    WorktreeRemovalReason::UnexpectedDirectory
}

pub(super) fn status_removal_reasons_with(
    worktree_path: &Path,
    run_git: RunGit<'_>,
) -> Vec<WorktreeRemovalReason> {
    let raw = match run_git(worktree_path, &["status", "--porcelain=v1"]) {
        Ok(found) => found,
        Err(_) => return vec![WorktreeRemovalReason::StatusUnavailable],
    };
    let mut reasons = Vec::new();
    if let GitWorkingTree::Known {
        staged,
        unstaged,
        untracked,
        unmerged,
        ..
    } = parse_working_tree(&raw)
    {
        if staged > 0 {
            reasons.push(WorktreeRemovalReason::StagedChanges);
        }
        if unstaged > 0 {
            reasons.push(WorktreeRemovalReason::UnstagedChanges);
        }
        if untracked > 0 {
            reasons.push(WorktreeRemovalReason::UntrackedFiles);
        }
        if unmerged > 0 {
            reasons.push(WorktreeRemovalReason::UnmergedConflicts);
        }
    }
    if in_progress_operation(worktree_path).is_some() {
        reasons.push(WorktreeRemovalReason::OperationInProgress);
    }
    reasons
}

fn validate_removal_with(
    repo_path: &Path,
    worktree_path: &Path,
    mode: WorktreeRemovalMode,
    run_git: RunGit<'_>,
) -> Result<PathBuf, WorktreeRemovalResult> {
    match inspect_worktree_with(repo_path, worktree_path, run_git) {
        WorktreeInspection::RepositoryUnavailable { path } => Err(WorktreeRemovalResult::Kept {
            path,
            reasons: vec![WorktreeRemovalReason::RepositoryUnavailable],
        }),
        WorktreeInspection::Missing { path } => Err(WorktreeRemovalResult::Missing { path }),
        WorktreeInspection::ForeignDirectory { path } => {
            let reason = foreign_directory_reason_with(repo_path, worktree_path, run_git);
            Err(WorktreeRemovalResult::Kept {
                path,
                reasons: vec![reason],
            })
        }
        WorktreeInspection::Registered {
            path,
            is_main: true,
            ..
        } => Err(WorktreeRemovalResult::Kept {
            path,
            reasons: vec![WorktreeRemovalReason::MainCheckout],
        }),
        WorktreeInspection::Registered {
            path,
            is_locked: true,
            ..
        } => Err(WorktreeRemovalResult::Kept {
            path,
            reasons: vec![WorktreeRemovalReason::Locked],
        }),
        WorktreeInspection::Registered { path, .. } => {
            let target = PathBuf::from(&path);
            match mode {
                WorktreeRemovalMode::Confirmed => Ok(target),
                WorktreeRemovalMode::Safe => {
                    let reasons = status_removal_reasons_with(&target, run_git);
                    if !reasons.is_empty() {
                        return Err(WorktreeRemovalResult::Kept { path, reasons });
                    }
                    Ok(target)
                }
            }
        }
    }
}

pub(crate) fn remove_worktree_checked_with(
    repo_path: &Path,
    worktree_path: &Path,
    mode: WorktreeRemovalMode,
    run_git: RunGit<'_>,
    is_lease_live: &mut dyn FnMut(&Path) -> bool,
) -> Result<WorktreeRemovalResult, WorktreeError> {
    let target = match validate_removal_with(repo_path, worktree_path, mode, run_git) {
        Ok(found) => found,
        Err(result) => return Ok(result),
    };
    let target_string = target.to_string_lossy().into_owned();
    let leased = WorktreeRemovalResult::Kept {
        path: target_string.clone(),
        reasons: vec![WorktreeRemovalReason::WriterLeaseHeld],
    };
    if is_lease_live(&target) {
        return Ok(leased);
    }
    let remove_args: Vec<&str> = match mode {
        WorktreeRemovalMode::Safe => vec!["worktree", "remove", target_string.as_str()],
        WorktreeRemovalMode::Confirmed => {
            vec!["worktree", "remove", "--force", target_string.as_str()]
        }
    };
    let first = run_git(repo_path, &remove_args);
    if first.is_ok() {
        return Ok(WorktreeRemovalResult::Removed {
            path: target_string,
        });
    }
    let error = first.unwrap_err();
    if !is_directory_not_empty(&error) {
        return Err(error);
    }
    std::thread::sleep(REMOVE_RETRY_DELAY);
    match validate_removal_with(repo_path, &target, mode, run_git) {
        Ok(_) => {}
        Err(WorktreeRemovalResult::Missing { .. }) => {
            return Ok(WorktreeRemovalResult::Removed {
                path: target_string,
            });
        }
        Err(result) => return Ok(result),
    }
    if is_lease_live(&target) {
        return Ok(leased);
    }
    if run_git(repo_path, &remove_args).is_ok() {
        return Ok(WorktreeRemovalResult::Removed {
            path: target_string,
        });
    }
    match validate_removal_with(repo_path, &target, mode, run_git) {
        Ok(revalidated) if revalidated == target => {}
        Ok(_) => {
            return Ok(WorktreeRemovalResult::Kept {
                path: target_string,
                reasons: vec![WorktreeRemovalReason::UnexpectedDirectory],
            });
        }
        Err(WorktreeRemovalResult::Missing { .. }) => {
            return Ok(WorktreeRemovalResult::Removed {
                path: target_string,
            });
        }
        Err(result) => return Ok(result),
    }
    if target.exists() {
        std::fs::remove_dir_all(&target)?;
    }
    crate::logging::note_failure("worktree prune", run_git(repo_path, &["worktree", "prune"]));
    if target.exists() {
        return Err(WorktreeError::Git {
            message: format!(
                "worktree folder is still on disk after cleanup: {target_string}. close anything running inside it and remove it by hand"
            ),
        });
    }
    Ok(WorktreeRemovalResult::Removed {
        path: target_string,
    })
}

pub(crate) fn remove_worktree_checked_leased(
    registry: &crate::worktree_writer::WriterLeaseRegistry,
    repo_path: &Path,
    worktree_path: &Path,
    mode: WorktreeRemovalMode,
) -> Result<WorktreeRemovalResult, WorktreeError> {
    remove_worktree_checked_with(
        repo_path,
        worktree_path,
        mode,
        &mut |cwd, args| git(cwd, args),
        &mut |path| {
            crate::worktree_writer::is_lease_live(registry, path.to_string_lossy().as_ref())
        },
    )
}

#[tauri::command]
pub async fn worktree_remove_checked(
    leases: tauri::State<'_, crate::worktree_writer::WriterLeases>,
    repo_path: String,
    worktree_path: String,
    mode: Option<WorktreeRemovalMode>,
) -> Result<WorktreeRemovalResult, WorktreeError> {
    let registry = leases.0.clone();
    let selected = mode.unwrap_or(WorktreeRemovalMode::Safe);
    tauri::async_runtime::spawn_blocking(move || {
        remove_worktree_checked_leased(
            &registry,
            Path::new(&repo_path),
            Path::new(&worktree_path),
            selected,
        )
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
