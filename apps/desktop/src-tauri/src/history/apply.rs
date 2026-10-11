use super::backups::{backup_namespace, is_backup_of, now_nanos, KEPT_STAMP};
use super::dirty::{
    dirty_files, drop_own_stash, find_stash, overlap_for_repo, push_stash, restore_stash,
    stash_message, touched_files,
};
use super::journal::{
    branch_ref, branch_tip, is_consistent, is_on_branch, journal_of, matches_tree, pending_stash,
    recover_journal, write_journal,
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

#[cfg(test)]
pub(crate) fn move_branch_blocking(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    new_head: &str,
) -> Result<MoveOutcome, WorktreeError> {
    move_branch_with(cwd, branch, expected_head, new_head, false, false)
}

#[cfg(test)]
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
    move_branch_with(cwd, branch, expected_head, &target, true, false)
}

pub(super) fn move_branch_with(
    cwd: &Path,
    branch: &str,
    expected_head: &str,
    new_head: &str,
    keeps_backup: bool,
    should_stash: bool,
) -> Result<MoveOutcome, WorktreeError> {
    if let Some((stash, _)) = pending_stash(cwd)? {
        return Ok(MoveOutcome::SetAside {
            stash,
            reason: "Your files from the last rebase are still set aside.".to_string(),
        });
    }
    if let Some(reason) = recover_journal(cwd)? {
        return Ok(MoveOutcome::Blocked { reason });
    }
    let current_branch = crate::worktree::current_branch_name(cwd).unwrap_or_default();
    if current_branch != branch {
        return Ok(MoveOutcome::Blocked {
            reason: format!("This worktree is on {current_branch}, not {branch}."),
        });
    }
    if let Some(reason) = blocking_reason(cwd, true) {
        return Ok(MoveOutcome::Blocked { reason });
    }
    let expected = resolve_commit(cwd, expected_head)?;
    let target = resolve_commit(cwd, new_head)?;
    let head = resolve_commit(cwd, "HEAD")?;
    if head != expected {
        return Ok(MoveOutcome::HeadMoved { head });
    }
    let dirty = dirty_files(cwd)?;
    let touched = touched_files(cwd, &expected, &target)?;
    let overlap = overlap_for_repo(cwd, &dirty, &touched)?;
    if !overlap.is_empty() && !should_stash {
        return Ok(MoveOutcome::NeedsStash {
            files: overlap,
            dirty_count: dirty.len(),
        });
    }
    if overlap.is_empty() {
        if let Some(reason) = untracked_in_the_way(cwd, &target) {
            return Ok(MoveOutcome::Blocked { reason });
        }
    }
    if should_stash && !overlap.is_empty() {
        let ignored = git(
            cwd,
            &[
                "ls-files",
                "--others",
                "--ignored",
                "--exclude-standard",
                "-z",
            ],
        )?;
        let tracked = git(cwd, &["ls-tree", "-r", "--name-only", "-z", "HEAD"])?;
        let target_files = git(cwd, &["ls-tree", "-r", "--name-only", "-z", &target])?;
        let protected = [
            super::dirty::paths(&tracked),
            super::dirty::paths(&target_files),
        ]
        .concat();
        if !overlap_for_repo(cwd, &super::dirty::paths(&ignored), &protected)?.is_empty() {
            return Ok(MoveOutcome::Blocked {
                reason: "An ignored file would be overwritten. Move it first. Nothing was changed."
                    .to_string(),
            });
        }
    }
    let backup_ref = format!(
        "{}/{}{}",
        backup_namespace(branch),
        if keeps_backup { KEPT_STAMP } else { "" },
        now_nanos()
    );
    git(cwd, &["update-ref", &backup_ref, &expected])?;
    let journal = journal_of(cwd).ok_or_else(|| plan_error("the worktree has no git directory"))?;
    write_journal(
        &journal,
        &format!("{expected}\n{target}\n{backup_ref}\n{branch}\n"),
    )?;
    let mut saved = None;
    if should_stash && !overlap.is_empty() {
        let label = format!("goodboy: rebase {branch} {}", now_nanos());
        let message = format!("On {branch}: {label}");
        let intent =
            format!("{expected}\n{target}\n{backup_ref}\n{branch}\nstash pending\n{message}\n");
        write_journal(&journal, &intent)?;
        let pushed = push_stash(cwd, &label);
        let ours = find_stash(cwd, &message, &expected)?;
        if let Some(sha) = &ours {
            git(
                cwd,
                &["update-ref", &format!("refs/goodboy/stash/{sha}"), sha, ""],
            )?;
            write_journal(
                &journal,
                &intent.replace("stash pending", &format!("stash {sha}")),
            )?;
        }
        let is_verified = pushed.as_ref().is_ok_and(|sha| Some(sha) == ours.as_ref())
            && pushed
                .as_ref()
                .is_ok_and(|sha| stash_message(cwd, sha).is_ok_and(|text| text == message));
        if !is_verified {
            if let Some(sha) = ours {
                if !is_on_branch(cwd, branch) || resolve_commit(cwd, "HEAD")? != expected {
                    return Ok(MoveOutcome::SetAside {
                        stash: sha,
                        reason: "The branch changed. Your files remain set aside.".to_string(),
                    });
                }
                let files = restore_stash(cwd, &sha)?;
                if files.is_empty() {
                    if !is_on_branch(cwd, branch) || resolve_commit(cwd, "HEAD")? != expected {
                        return Ok(MoveOutcome::SetAside {
                            stash: sha,
                            reason: "The branch changed while restoring. The stash was kept."
                                .to_string(),
                        });
                    }
                    if let Err(error) = finish_restoration(cwd, &journal, &sha, &message) {
                        return Ok(MoveOutcome::Blocked {
                            reason: format!(
                                "Your files are back, but stash cleanup failed: {error}"
                            ),
                        });
                    }
                    return Ok(MoveOutcome::Blocked {
                        reason: "Couldn't set your files aside safely. Nothing was changed."
                            .to_string(),
                    });
                }
                return Ok(MoveOutcome::SetAside {
                    stash: sha,
                    reason: "Your files remain saved, but restoring them needs attention."
                        .to_string(),
                });
            }
            return Err(plan_error("Couldn't locate the saved files safely. The journal was kept. Check the stash in the terminal before continuing."));
        }
        saved = ours.map(|sha| (sha, message));
        #[cfg(test)]
        BEFORE_MOVE.with(|hook| {
            if let Some(hook) = hook.borrow_mut().take() {
                hook(cwd);
            }
        });
    }
    let outcome = apply_move(cwd, branch, &expected, &target, &backup_ref);
    if let Some((sha, message)) = saved {
        let outcome = outcome?;
        if !matches!(outcome, MoveOutcome::Moved { .. }) {
            return Ok(MoveOutcome::SetAside {
                stash: sha,
                reason: "The move did not finish. Your files remain set aside.".to_string(),
            });
        }
        if !is_on_branch(cwd, branch) || resolve_commit(cwd, "HEAD")? != target {
            return Ok(MoveOutcome::SetAside {
                stash: sha,
                reason: "The branch changed. Your files remain set aside.".to_string(),
            });
        }
        let files = restore_stash(cwd, &sha)?;
        if !files.is_empty() {
            return Ok(MoveOutcome::RestoreConflict {
                stash: sha,
                files,
                head: target,
                backup_ref,
            });
        }
        if !is_on_branch(cwd, branch) || resolve_commit(cwd, "HEAD")? != target {
            return Ok(MoveOutcome::SetAside {
                stash: sha,
                reason: "The branch changed while restoring. The stash was kept.".to_string(),
            });
        }
        return Ok(MoveOutcome::Moved {
            head: target,
            backup_ref,
            carried_count: 0,
            cleanup_error: finish_restoration(cwd, &journal, &sha, &message)
                .err()
                .map(|error| format!("Stash {sha}: {error}")),
        });
    }
    let outcome = outcome.map(|outcome| match outcome {
        MoveOutcome::Moved {
            head, backup_ref, ..
        } => MoveOutcome::Moved {
            cleanup_error: None,
            head,
            backup_ref,
            carried_count: dirty.len(),
        },
        other => other,
    });
    if matches!(&outcome, Ok(MoveOutcome::Moved { .. })) || is_consistent(cwd) {
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
            cleanup_error: None,
            carried_count: 0,
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
            if let Some(stash) = &args.restore_stash {
                return bring_back(&cwd, &args.branch, &args.expected_head, stash);
            }
            move_branch_with(
                &cwd,
                &args.branch,
                &args.expected_head,
                &args.new_head,
                false,
                args.should_stash,
            )
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
            let target = resolve_commit(&cwd, &args.backup_ref)?;
            move_branch_with(
                &cwd,
                &args.branch,
                &args.expected_head,
                &target,
                true,
                args.should_stash,
            )
        })
    })
    .await
    .map_err(|e| WorktreeError::Io(std::io::Error::other(e.to_string())))?
}

fn mark_restored(journal: &Path) -> Result<(), WorktreeError> {
    let raw = std::fs::read_to_string(journal)?;
    write_journal(journal, &format!("{}\nrestored\n", raw.trim_end()))?;
    Ok(())
}

fn finish_restoration(
    cwd: &Path,
    journal: &Path,
    sha: &str,
    message: &str,
) -> Result<(), WorktreeError> {
    mark_restored(journal)?;
    drop_own_stash(cwd, sha, message)?;
    git(
        cwd,
        &[
            "update-ref",
            "-d",
            &format!("refs/goodboy/stash/{sha}"),
            sha,
        ],
    )?;
    std::fs::remove_file(journal)?;
    Ok(())
}

pub(super) fn bring_back(
    cwd: &Path,
    branch: &str,
    expected: &str,
    sha: &str,
) -> Result<MoveOutcome, WorktreeError> {
    if !is_on_branch(cwd, branch) || resolve_commit(cwd, "HEAD")? != expected {
        return Ok(MoveOutcome::Blocked {
            reason: "The branch moved. Check the saved files in the terminal.".to_string(),
        });
    }
    let Some((recorded, message)) = pending_stash(cwd)? else {
        return Ok(MoveOutcome::Blocked {
            reason: "No files are waiting to be brought back.".to_string(),
        });
    };
    let journal = journal_of(cwd).ok_or_else(|| plan_error("the worktree has no git directory"))?;
    let raw = std::fs::read_to_string(&journal)?;
    if recorded != sha || raw.lines().nth(3) != Some(branch) {
        return Err(plan_error("these saved files belong to another rewrite"));
    }
    let lines: Vec<&str> = raw.lines().collect();
    let old = lines.first().copied().unwrap_or_default();
    let new = lines.get(1).copied().unwrap_or_default();
    if expected == old && matches_tree(cwd, new) {
        git(cwd, &["read-tree", "-m", "-u", new, old])?;
    }
    if expected == new && matches_tree(cwd, old) {
        git(cwd, &["read-tree", "-m", "-u", old, new])?;
    }
    if let Some(reason) = blocking_reason(cwd, false) {
        return Ok(MoveOutcome::Blocked { reason });
    }
    let files = restore_stash(cwd, sha)?;
    if !files.is_empty() {
        return Ok(MoveOutcome::RestoreConflict {
            stash: sha.to_string(),
            files,
            head: expected.to_string(),
            backup_ref: raw.lines().nth(2).unwrap_or_default().to_string(),
        });
    }
    if !is_on_branch(cwd, branch) || resolve_commit(cwd, "HEAD")? != expected {
        return Ok(MoveOutcome::SetAside {
            stash: sha.to_string(),
            reason: "The branch changed while restoring. The stash was kept.".to_string(),
        });
    }
    Ok(MoveOutcome::FilesRestored {
        stash: sha.to_string(),
        cleanup_error: finish_restoration(cwd, &journal, sha, &message)
            .err()
            .map(|error| format!("Stash {sha}: {error}")),
    })
}

#[cfg(test)]
type MoveHook = Box<dyn FnOnce(&Path)>;

#[cfg(test)]
thread_local! {
    pub(super) static BEFORE_MOVE: std::cell::RefCell<Option<MoveHook>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
mod tests;
