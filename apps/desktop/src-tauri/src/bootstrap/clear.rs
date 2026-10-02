use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::lock::MoveLock;
use super::snapshot::{
    absolute_git_dir, hash_paths, list_changes, matches_snapshot, mismatches, run, Change,
    FileChange,
};
use super::BootstrapError;
use crate::proc::git::Git;
use crate::worktree::git;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClearReport {
    pub cleared: Vec<String>,
    pub kept: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum AlignOutcome {
    AlreadyAligned,
    FastForwarded,
    Reset,
    Skipped { reason: String },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum RecoverState {
    Verified,
    WorktreeMissing,
    Mismatch { paths: Vec<String> },
}

fn is_object_id(raw: &str) -> bool {
    (raw.len() == 40 || raw.len() == 64) && raw.chars().all(|c| c.is_ascii_hexdigit())
}

pub(crate) fn rev(root: &Path, name: &str) -> Option<String> {
    git(root, &["rev-parse", "--verify", "--quiet", name])
        .ok()
        .map(|raw| raw.trim().to_string())
        .filter(|found| !found.is_empty())
}

pub(crate) fn checked_snapshot(root: &Path, snapshot_id: &str) -> Result<(), BootstrapError> {
    if !is_object_id(snapshot_id) {
        return Err(BootstrapError::InvalidInput(
            "the snapshot id is not a commit id".to_string(),
        ));
    }
    let kind = run(root, &["cat-file", "-t", snapshot_id])?;
    if kind.trim() != "commit" {
        return Err(BootstrapError::InvalidInput(
            "the snapshot is not a commit".to_string(),
        ));
    }
    let parent = rev(root, &format!("{snapshot_id}^"));
    if parent.is_none() || parent != rev(root, "HEAD") {
        return Err(BootstrapError::RootMoved);
    }
    Ok(())
}

fn paths_touched_by_remote(
    root: &Path,
    worktree: &Path,
) -> Result<HashSet<String>, BootstrapError> {
    let head = run(worktree, &["rev-parse", "HEAD"])?.trim().to_string();
    let raw = run(root, &["diff", "--name-only", "-z", "HEAD", &head])?;
    Ok(raw
        .split('\0')
        .filter(|path| !path.is_empty())
        .map(str::to_string)
        .collect())
}

fn pathspec_input(paths: &[&Change]) -> Vec<u8> {
    let mut input = Vec::new();
    for change in paths {
        input.extend_from_slice(change.path.as_bytes());
        input.push(0);
    }
    input
}

fn with_pathspec(root: &Path, args: &[&str], paths: &[&Change]) -> Result<(), BootstrapError> {
    if paths.is_empty() {
        return Ok(());
    }
    Git::new()
        .cwd(root)
        .args(args)
        .args(["--pathspec-from-file=-", "--pathspec-file-nul"])
        .input(pathspec_input(paths))
        .stdout()
        .map_err(super::snapshot::git_failure)?;
    Ok(())
}

fn remove_empty_parents(root: &Path, file: &Path) {
    let mut current = file.parent().map(Path::to_path_buf);
    while let Some(dir) = current {
        if dir == root || !dir.starts_with(root) {
            return;
        }
        if std::fs::remove_dir(&dir).is_err() {
            return;
        }
        current = dir.parent().map(Path::to_path_buf);
    }
}

pub(crate) fn verified_worktree(
    root: &Path,
    worktree: &Path,
    changes: &[Change],
) -> Result<Vec<String>, BootstrapError> {
    let skip = paths_touched_by_remote(root, worktree)?;
    mismatches(worktree, changes, &skip)
}

pub(crate) fn clear_root(
    root: &Path,
    snapshot_id: &str,
    worktree_path: &Path,
) -> Result<ClearReport, BootstrapError> {
    let _lock = MoveLock::acquire(&absolute_git_dir(root)?)?;
    checked_snapshot(root, snapshot_id)?;
    if !worktree_path.is_dir() {
        return Err(BootstrapError::InvalidInput(
            "the bootstrap worktree is missing".to_string(),
        ));
    }
    let changes = list_changes(root, snapshot_id)?;
    let bad = verified_worktree(root, worktree_path, &changes)?;
    if !bad.is_empty() {
        return Err(BootstrapError::VerifyFailed(bad.join(", ")));
    }
    let paths: Vec<String> = changes.iter().map(|change| change.path.clone()).collect();
    let current = hash_paths(root, &paths)?;
    let mut clear: Vec<&Change> = Vec::new();
    let mut kept: Vec<String> = Vec::new();
    for change in &changes {
        let content = current.get(&change.path).cloned().unwrap_or(None);
        if matches_snapshot(change, &content) {
            clear.push(change);
        } else {
            kept.push(change.path.clone());
        }
    }
    let added: Vec<&Change> = clear
        .iter()
        .copied()
        .filter(|change| change.change == FileChange::Added)
        .collect();
    let tracked: Vec<&Change> = clear
        .iter()
        .copied()
        .filter(|change| change.change != FileChange::Added)
        .collect();
    with_pathspec(root, &["rm", "--cached", "-q", "--ignore-unmatch"], &added)?;
    with_pathspec(
        root,
        &["restore", "--source=HEAD", "--staged", "--worktree"],
        &tracked,
    )?;
    for change in &added {
        let full = root.join(&change.path);
        match std::fs::remove_file(&full) {
            Ok(()) => remove_empty_parents(root, &full),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(BootstrapError::Io(error)),
        }
    }
    Ok(ClearReport {
        cleared: clear.iter().map(|change| change.path.clone()).collect(),
        kept,
    })
}

fn is_single_ignore_commit(root: &Path) -> bool {
    let count = git(root, &["rev-list", "--count", "HEAD"])
        .ok()
        .map(|raw| raw.trim().to_string());
    if count.as_deref() != Some("1") {
        return false;
    }
    git(root, &["show", "--name-only", "--format=", "HEAD"])
        .ok()
        .is_some_and(|raw| raw.trim() == ".gitignore")
}

fn skipped(reason: &str) -> AlignOutcome {
    AlignOutcome::Skipped {
        reason: reason.to_string(),
    }
}

pub(crate) fn align_main(root: &Path, base_branch: &str) -> Result<AlignOutcome, BootstrapError> {
    let _lock = MoveLock::acquire(&absolute_git_dir(root)?)?;
    let current = run(root, &["symbolic-ref", "--quiet", "--short", "HEAD"])
        .map(|raw| raw.trim().to_string())
        .unwrap_or_default();
    if current != base_branch {
        return Ok(skipped("branch-differs"));
    }
    let remote_ref = format!("refs/remotes/origin/{base_branch}");
    let Some(remote) = rev(root, &format!("{remote_ref}^{{commit}}")) else {
        return Ok(skipped("remote-missing"));
    };
    let status = run(root, &["status", "--porcelain"])?;
    if !status.trim().is_empty() {
        return Ok(skipped("folder-not-clean"));
    }
    let local = rev(root, "HEAD").unwrap_or_default();
    let upstream = format!("origin/{base_branch}");
    if local == remote {
        let _ = git(
            root,
            &["branch", "--set-upstream-to", &upstream, base_branch],
        );
        return Ok(AlignOutcome::AlreadyAligned);
    }
    let behind = git(root, &["merge-base", "--is-ancestor", "HEAD", &remote]).is_ok();
    if behind {
        run(root, &["merge", "--ff-only", &remote])?;
        let _ = git(
            root,
            &["branch", "--set-upstream-to", &upstream, base_branch],
        );
        return Ok(AlignOutcome::FastForwarded);
    }
    if !is_single_ignore_commit(root) {
        return Ok(skipped("histories-differ"));
    }
    run(root, &["reset", "--keep", &remote])?;
    crate::worktree::ensure_goodboy_excluded(root);
    let _ = git(
        root,
        &["branch", "--set-upstream-to", &upstream, base_branch],
    );
    Ok(AlignOutcome::Reset)
}

pub(crate) fn recover(
    root: &Path,
    snapshot_id: &str,
    worktree_path: &Path,
) -> Result<RecoverState, BootstrapError> {
    if !is_object_id(snapshot_id) {
        return Err(BootstrapError::InvalidInput(
            "the snapshot id is not a commit id".to_string(),
        ));
    }
    if !worktree_path.is_dir() {
        return Ok(RecoverState::WorktreeMissing);
    }
    let changes = list_changes(root, snapshot_id)?;
    let bad = verified_worktree(root, worktree_path, &changes)?;
    if bad.is_empty() {
        return Ok(RecoverState::Verified);
    }
    Ok(RecoverState::Mismatch { paths: bad })
}

pub(crate) fn worktree_under_goodboy(root: &Path, worktree_path: &Path) -> Option<PathBuf> {
    let parent = root.join(".goodboy").join("worktrees");
    let resolved =
        std::fs::canonicalize(worktree_path).unwrap_or_else(|_| worktree_path.to_path_buf());
    let parent = std::fs::canonicalize(&parent).unwrap_or(parent);
    (resolved.starts_with(&parent) && resolved != parent).then_some(resolved)
}
