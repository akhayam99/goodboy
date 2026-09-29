use super::error::WorktreeError;
use super::git::{git, RunGit};
use super::inspect::{canonical_path, inspect_worktree_with};
use super::orphans::worktrees_parent;
use super::remove::{
    foreign_directory_reason_with, remove_worktree_checked_with, status_removal_reasons_with,
};
use super::types::{
    WorktreeInspection, WorktreeRemovalMode, WorktreeRemovalReason, WorktreeRemovalResult,
};
use std::path::{Path, PathBuf};

fn kept_folder(path: &Path, reason: WorktreeRemovalReason) -> WorktreeRemovalResult {
    WorktreeRemovalResult::Kept {
        path: path.to_string_lossy().into_owned(),
        reasons: vec![reason],
    }
}

pub(crate) fn contained_worktrees_parent(repo_path: &Path) -> Option<PathBuf> {
    let repo = canonical_path(repo_path)?;
    let parent = canonical_path(&worktrees_parent(repo_path))?;
    parent.starts_with(&repo).then_some(parent)
}

fn unpushed_commit_count_with(
    repo_path: &Path,
    worktree_path: &Path,
    run_git: RunGit<'_>,
) -> Option<u32> {
    let default_branch = run_git(repo_path, &["symbolic-ref", "--quiet", "HEAD"])
        .ok()
        .map(|raw| raw.trim().to_string())
        .filter(|name| !name.is_empty());
    let mut args = vec!["rev-list", "--count", "HEAD", "--not", "--remotes"];
    if let Some(name) = default_branch.as_deref() {
        args.push(name);
    }
    run_git(worktree_path, &args)
        .ok()
        .and_then(|raw| raw.trim().parse::<u32>().ok())
}

fn unpushed_folder_kept_with(
    repo_path: &Path,
    folder: &Path,
    run_git: RunGit<'_>,
    is_lease_live: &mut dyn FnMut(&Path) -> bool,
) -> Option<WorktreeRemovalResult> {
    let unpushed = match unpushed_commit_count_with(repo_path, folder, run_git) {
        Some(0) => return None,
        Some(_) => WorktreeRemovalReason::UnpushedCommits,
        None => WorktreeRemovalReason::StatusUnavailable,
    };
    let mut reasons = Vec::new();
    if is_lease_live(folder) {
        reasons.push(WorktreeRemovalReason::WriterLeaseHeld);
    }
    reasons.extend(status_removal_reasons_with(folder, run_git));
    reasons.push(unpushed);
    Some(WorktreeRemovalResult::Kept {
        path: folder.to_string_lossy().into_owned(),
        reasons,
    })
}

#[cfg(test)]
pub(crate) fn remove_worktree_folder_with(
    repo_path: &Path,
    target: &Path,
    mode: WorktreeRemovalMode,
    run_git: RunGit<'_>,
    is_lease_live: &mut dyn FnMut(&Path) -> bool,
) -> Result<WorktreeRemovalResult, WorktreeError> {
    remove_worktree_folder_allowing(repo_path, target, mode, false, run_git, is_lease_live)
}

pub(crate) fn remove_worktree_folder_allowing(
    repo_path: &Path,
    target: &Path,
    mode: WorktreeRemovalMode,
    allow_local_commits: bool,
    run_git: RunGit<'_>,
    is_lease_live: &mut dyn FnMut(&Path) -> bool,
) -> Result<WorktreeRemovalResult, WorktreeError> {
    let Some(parent) = contained_worktrees_parent(repo_path) else {
        return Ok(kept_folder(
            target,
            WorktreeRemovalReason::OutsideWorktreeFolder,
        ));
    };
    let metadata = match std::fs::symlink_metadata(target) {
        Ok(found) => found,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let lexical_parent = target.parent().and_then(canonical_path);
            if lexical_parent.as_deref() != Some(parent.as_path()) {
                return Ok(kept_folder(
                    target,
                    WorktreeRemovalReason::OutsideWorktreeFolder,
                ));
            }
            let _ = run_git(repo_path, &["worktree", "prune"]);
            return Ok(WorktreeRemovalResult::Missing {
                path: target.to_string_lossy().into_owned(),
            });
        }
        Err(error) => return Err(WorktreeError::Io(error)),
    };
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Ok(kept_folder(
            target,
            WorktreeRemovalReason::OutsideWorktreeFolder,
        ));
    }
    let Some(folder) = canonical_path(target) else {
        return Ok(kept_folder(
            target,
            WorktreeRemovalReason::OutsideWorktreeFolder,
        ));
    };
    if folder.parent() != Some(parent.as_path()) {
        return Ok(kept_folder(
            target,
            WorktreeRemovalReason::OutsideWorktreeFolder,
        ));
    }
    match inspect_worktree_with(repo_path, &folder, run_git) {
        WorktreeInspection::Registered { .. } => {
            if mode == WorktreeRemovalMode::Safe && !allow_local_commits {
                if let Some(kept) =
                    unpushed_folder_kept_with(repo_path, &folder, run_git, is_lease_live)
                {
                    return Ok(kept);
                }
            }
            return remove_worktree_checked_with(repo_path, &folder, mode, run_git, is_lease_live);
        }
        WorktreeInspection::Missing { path } => {
            return Ok(WorktreeRemovalResult::Missing { path });
        }
        WorktreeInspection::RepositoryUnavailable { .. } => {
            return Ok(kept_folder(
                &folder,
                WorktreeRemovalReason::RepositoryUnavailable,
            ));
        }
        WorktreeInspection::ForeignDirectory { .. } => {}
    }
    if foreign_directory_reason_with(repo_path, &folder, run_git)
        == WorktreeRemovalReason::DifferentRepository
    {
        return Ok(kept_folder(
            &folder,
            WorktreeRemovalReason::DifferentRepository,
        ));
    }
    if is_lease_live(&folder) {
        return Ok(kept_folder(&folder, WorktreeRemovalReason::WriterLeaseHeld));
    }
    if mode == WorktreeRemovalMode::Safe {
        return Ok(kept_folder(&folder, WorktreeRemovalReason::NotRegistered));
    }
    std::fs::remove_dir_all(&folder)?;
    let _ = run_git(repo_path, &["worktree", "prune"]);
    Ok(WorktreeRemovalResult::Removed {
        path: folder.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub async fn worktree_folder_remove(
    leases: tauri::State<'_, crate::worktree_writer::WriterLeases>,
    repo_path: String,
    path: String,
    mode: Option<WorktreeRemovalMode>,
    allow_local_commits: Option<bool>,
) -> Result<WorktreeRemovalResult, WorktreeError> {
    let registry = leases.0.clone();
    let selected = mode.unwrap_or(WorktreeRemovalMode::Safe);
    tauri::async_runtime::spawn_blocking(move || {
        remove_worktree_folder_allowing(
            Path::new(&repo_path),
            Path::new(&path),
            selected,
            allow_local_commits.unwrap_or(false),
            &mut |cwd, args| git(cwd, args),
            &mut |target| {
                crate::worktree_writer::is_lease_live(&registry, target.to_string_lossy().as_ref())
            },
        )
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}
