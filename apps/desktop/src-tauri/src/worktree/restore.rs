use super::branch_name::branch_name_problem;
use super::create::branch_checkout_path_with;
use super::error::WorktreeError;
use super::folder::contained_worktrees_parent;
use super::git::{git, RunGit};
use super::inspect::canonical_path;
use super::orphans::worktrees_parent;
use super::types::{WorktreeRestoreRefusal, WorktreeRestoreResult};
use std::path::Path;

fn refused(path: &Path, reason: WorktreeRestoreRefusal) -> WorktreeRestoreResult {
    WorktreeRestoreResult::Refused {
        path: path.to_string_lossy().into_owned(),
        reason,
    }
}

pub(crate) fn restore_worktree_folder_with(
    repo_path: &Path,
    target: &Path,
    branch: &str,
    run_git: RunGit<'_>,
) -> Result<WorktreeRestoreResult, WorktreeError> {
    if branch_name_problem(branch).is_some() {
        return Ok(refused(target, WorktreeRestoreRefusal::BranchMissing));
    }
    std::fs::create_dir_all(worktrees_parent(repo_path))?;
    let Some(parent) = contained_worktrees_parent(repo_path) else {
        return Ok(refused(
            target,
            WorktreeRestoreRefusal::OutsideWorktreeFolder,
        ));
    };
    let lexical_parent = target.parent().and_then(canonical_path);
    let Some(name) = target.file_name() else {
        return Ok(refused(
            target,
            WorktreeRestoreRefusal::OutsideWorktreeFolder,
        ));
    };
    if lexical_parent.as_deref() != Some(parent.as_path()) {
        return Ok(refused(
            target,
            WorktreeRestoreRefusal::OutsideWorktreeFolder,
        ));
    }
    let destination = parent.join(name);
    if std::fs::symlink_metadata(&destination).is_ok() {
        return Ok(refused(target, WorktreeRestoreRefusal::PathTaken));
    }
    let local_ref = format!("refs/heads/{branch}");
    if run_git(repo_path, &["rev-parse", "--verify", "--quiet", &local_ref]).is_err() {
        return Ok(refused(target, WorktreeRestoreRefusal::BranchMissing));
    }
    if branch_checkout_path_with(repo_path, branch, run_git).is_some() {
        return Ok(refused(target, WorktreeRestoreRefusal::BranchInUse));
    }
    crate::logging::note_failure("worktree prune", run_git(repo_path, &["worktree", "prune"]));
    run_git(
        repo_path,
        &[
            "worktree",
            "add",
            destination.to_string_lossy().as_ref(),
            branch,
        ],
    )?;
    Ok(WorktreeRestoreResult::Restored {
        path: destination.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub async fn worktree_folder_restore(
    repo_path: String,
    path: String,
    branch: String,
) -> Result<WorktreeRestoreResult, WorktreeError> {
    tauri::async_runtime::spawn_blocking(move || {
        restore_worktree_folder_with(
            Path::new(&repo_path),
            Path::new(&path),
            &branch,
            &mut |cwd, args| git(cwd, args),
        )
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
