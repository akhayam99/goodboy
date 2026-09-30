use super::backups::{backup_namespace, is_backup_of, now_nanos, KEPT_STAMP};
use super::journal::{
    branch_ref, branch_tip, is_consistent, is_on_branch, journal_of, recover_journal,
};
use super::plan::plan_error;
use super::preflight::{blocking_reason, untracked_in_the_way};
use super::runner::git_run;
use super::types::{MoveBranchArgs, MoveOutcome, RestoreArgs};
use crate::worktree::{git, resolve_commit, WorktreeError};
use crate::worktree_writer::{
    acquire_lease, cancel_lease, release_lease, WriterLeaseRegistry, WriterLeases,
};
use std::path::{Path, PathBuf};
use tauri::State;

pub(super) const LEASE_HOLDER: &str = "history-rewrite";

pub(crate) fn move_branch_blocking(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    new_head: &str,
) -> Result<MoveOutcome, WorktreeError> {
    move_branch_with(cwd, branch, expected_head, new_head, false)
}

pub(crate) fn restore_blocking(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    backup_ref: &str,
) -> Result<MoveOutcome, WorktreeError> {
    if !is_backup_of(branch, backup_ref) {
        return Err(plan_error("that backup belongs to another branch"));
    }
    let target = resolve_commit(cwd, backup_ref)?;
    move_branch_with(cwd, branch, expected_head, &target, true)
}

fn move_branch_with(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    new_head: &str,
    keeps_backup: bool,
) -> Result<MoveOutcome, WorktreeError> {
    if let Some(reason) = recover_journal(cwd)? {
        return Ok(MoveOutcome::Blocked { reason });
    }
    let current_branch = crate::worktree::current_branch_name(cwd).unwrap_or_default();
    if current_branch != branch {
        return Ok(MoveOutcome::Blocked {
            reason: format!("This worktree is on {current_branch}, not {branch}."),
        });
    }
    if let Some(reason) = blocking_reason(cwd) {
        return Ok(MoveOutcome::Blocked { reason });
    }
    let expected = resolve_commit(cwd, expected_head)?;
    let target = resolve_commit(cwd, new_head)?;
    let head = resolve_commit(cwd, "HEAD")?;
    if head != expected {
        return Ok(MoveOutcome::HeadMoved { head });
    }
    if let Some(reason) = untracked_in_the_way(cwd, &target) {
        return Ok(MoveOutcome::Blocked { reason });
    }
    let backup_ref = format!(
        "{}/{}{}",
        backup_namespace(branch),
        if keeps_backup { KEPT_STAMP } else { "" },
        now_nanos()
    );
    git(cwd, &["update-ref", &backup_ref, &expected])?;
    let journal = journal_of(cwd).ok_or_else(|| plan_error("the worktree has no git directory"))?;
    std::fs::write(
        &journal,
        format!("{expected}\n{target}\n{backup_ref}\n{branch}\n"),
    )?;
    let outcome = apply_move(cwd, branch, &expected, &target, &backup_ref);
    if is_consistent(cwd) {
        let _ = std::fs::remove_file(&journal);
    }
    outcome
}

pub(crate) fn apply_move(
    cwd: &Path,
    branch: &str,
    expected: &str,
    target: &str,
    backup_ref: &str,
) -> Result<MoveOutcome, WorktreeError> {
    if !is_on_branch(cwd, branch) {
        return Ok(MoveOutcome::Blocked {
            reason: format!("This worktree is no longer on {branch}, so nothing was changed."),
        });
    }
    let tip = branch_tip(cwd, branch).unwrap_or_default();
    if tip != expected {
        return Ok(MoveOutcome::HeadMoved { head: tip });
    }
    let files = git_run(
        cwd,
        &["read-tree", "-m", "-u", expected, target],
        None,
        None,
    )?;
    if files.status != 0 {
        return Ok(MoveOutcome::Blocked {
            reason: format!(
                "Git refused to update the files without losing work, so nothing was changed. {}",
                files.stderr.trim()
            ),
        });
    }
    let reference = branch_ref(branch);
    let moved = git_run(
        cwd,
        &[
            "update-ref",
            "-m",
            "goodboy: rewrite history",
            &reference,
            target,
            expected,
        ],
        None,
        None,
    )?;
    if moved.status == 0 && is_on_branch(cwd, branch) {
        return Ok(MoveOutcome::Moved {
            head: target.to_string(),
            backup_ref: backup_ref.to_string(),
        });
    }
    if moved.status == 0 {
        let _ = git_run(
            cwd,
            &["update-ref", &reference, expected, target],
            None,
            None,
        );
    }
    let head = resolve_commit(cwd, "HEAD")?;
    let back = git_run(cwd, &["read-tree", "-m", "-u", target, &head], None, None)?;
    if back.status == 0 {
        return Ok(MoveOutcome::HeadMoved { head });
    }
    Ok(MoveOutcome::Blocked {
        reason: format!(
            "The branch changed while the files were updated. Nothing was reset; the files now match the rewrite and the previous history is kept as {backup_ref}."
        ),
    })
}

fn with_lease(
    registry: &WriterLeaseRegistry,
    path: &str,
    run: impl FnOnce() -> Result<MoveOutcome, WorktreeError>,
) -> Result<MoveOutcome, WorktreeError> {
    let status = acquire_lease(registry, path, LEASE_HOLDER, None);
    if !status.is_granted {
        cancel_lease(registry, path, LEASE_HOLDER);
        return Ok(MoveOutcome::Busy {
            holder: status.holder,
        });
    }
    let outcome = run();
    release_lease(registry, path, LEASE_HOLDER, status.token.as_deref());
    outcome
}

#[tauri::command]
pub async fn history_plan_apply(
    leases: State<'_, WriterLeases>,
    args: MoveBranchArgs,
) -> Result<MoveOutcome, WorktreeError> {
    let registry = leases.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&args.worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(args.worktree_path));
        }
        with_lease(&registry, &args.worktree_path, || {
            move_branch_blocking(&cwd, &args.branch, &args.expected_head, &args.new_head)
        })
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[tauri::command]
pub async fn history_restore(
    leases: State<'_, WriterLeases>,
    args: RestoreArgs,
) -> Result<MoveOutcome, WorktreeError> {
    let registry = leases.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let cwd = PathBuf::from(&args.worktree_path);
        if !cwd.exists() {
            return Err(WorktreeError::RepoNotFound(args.worktree_path));
        }
        if !is_backup_of(&args.branch, &args.backup_ref) {
            return Err(plan_error("that backup belongs to another branch"));
        }
        with_lease(&registry, &args.worktree_path, || {
            restore_blocking(&cwd, &args.branch, &args.expected_head, &args.backup_ref)
        })
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

#[cfg(test)]
mod tests;
