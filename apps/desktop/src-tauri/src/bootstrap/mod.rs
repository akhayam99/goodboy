mod clear;
mod lock;
mod snapshot;

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::repo::{has_commit, is_repo_root};
use crate::worktree::{
    git, ignored_files_at_risk, in_progress_operation, worktree_create_blocking, CreateArgs,
};
use clear::{align_main, clear_root, recover, rev, verified_worktree, worktree_under_goodboy};
pub use clear::{AlignOutcome, ClearReport, RecoverState};
use lock::MoveLock;
pub use snapshot::FileChange;
use snapshot::{
    absolute_git_dir, list_changes, nested_repositories, object_sizes, run, take_snapshot,
};

const LARGE_FILE_BYTES: u64 = 100 * 1024 * 1024;
const DEFAULT_SLUG: &str = "bootstrap";

#[derive(Debug, Error)]
pub enum BootstrapError {
    #[error("{0} is not a git repository root")]
    NotARepo(String),
    #[error("the project has no commit yet")]
    NoCommit,
    #[error("another move is running for this project")]
    Locked,
    #[error("a {0} is in progress in the project folder")]
    OperationInProgress(String),
    #[error("{0} files in the project folder have merge conflicts")]
    Unmerged(usize),
    #[error("there is nothing to move")]
    NothingToMove,
    #[error("these folders hold their own git repository: {0}")]
    NestedRepository(String),
    #[error("the remote branch {0} is not available here yet")]
    RemoteBranchMissing(String),
    #[error("{0}")]
    InvalidInput(String),
    #[error("a branch named {0} already exists")]
    BranchTaken(String),
    #[error("the work does not apply on top of {base}: {paths}")]
    ApplyConflict { base: String, paths: String },
    #[error("the copy does not match the project folder for: {0}")]
    VerifyFailed(String),
    #[error("the project folder changed since the snapshot was taken")]
    RootMoved,
    #[error("git failed: {message}")]
    Git { message: String },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

crate::util::impl_error_serialize!(BootstrapError);

impl BootstrapError {
    fn kind(&self) -> &'static str {
        match self {
            BootstrapError::NotARepo(_) => "not_a_repo",
            BootstrapError::NoCommit => "no_commit",
            BootstrapError::Locked => "locked",
            BootstrapError::OperationInProgress(_) => "operation_in_progress",
            BootstrapError::Unmerged(_) => "unmerged",
            BootstrapError::NothingToMove => "nothing_to_move",
            BootstrapError::NestedRepository(_) => "nested_repository",
            BootstrapError::RemoteBranchMissing(_) => "remote_branch_missing",
            BootstrapError::InvalidInput(_) => "invalid_input",
            BootstrapError::BranchTaken(_) => "branch_taken",
            BootstrapError::ApplyConflict { .. } => "apply_conflict",
            BootstrapError::VerifyFailed(_) => "verify_failed",
            BootstrapError::RootMoved => "root_moved",
            BootstrapError::Git { .. } => "git",
            BootstrapError::Io(_) => "io",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareArgs {
    pub project_path: String,
    pub project_key: String,
    pub branch_prefix: String,
    pub base_branch: String,
    #[serde(default)]
    pub slug: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MovedFile {
    pub path: String,
    pub change: FileChange,
    pub size: u64,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredAtRisk {
    pub count: u32,
    pub samples: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapPrepared {
    pub snapshot_id: String,
    pub snapshot_ref: String,
    pub worktree_path: String,
    pub branch: String,
    pub base_branch: String,
    pub files: Vec<MovedFile>,
    pub large_files: Vec<String>,
    pub ignored_at_risk: IgnoredAtRisk,
}

fn is_safe_token(raw: &str) -> bool {
    !raw.is_empty()
        && raw.len() <= 80
        && raw
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

fn is_safe_branch(raw: &str) -> bool {
    !raw.is_empty()
        && !raw.starts_with('-')
        && !raw.starts_with('/')
        && !raw.ends_with('/')
        && !raw.contains("..")
        && !raw.contains("//")
        && raw
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/'))
}

fn repo_root(project_path: &str) -> Result<PathBuf, BootstrapError> {
    let root = Path::new(project_path.trim());
    if !root.is_dir() || !is_repo_root(root) {
        return Err(BootstrapError::NotARepo(project_path.to_string()));
    }
    if !has_commit(root) {
        return Err(BootstrapError::NoCommit);
    }
    Ok(root.to_path_buf())
}

fn unmerged_count(root: &Path) -> usize {
    git(root, &["diff", "--name-only", "--diff-filter=U"])
        .map(|raw| raw.lines().filter(|line| !line.trim().is_empty()).count())
        .unwrap_or(0)
}

fn remove_worktree(root: &Path, worktree_path: &Path, branch: &str) {
    let path_text = worktree_path.to_string_lossy();
    let _ = git(root, &["worktree", "remove", "--force", path_text.as_ref()]);
    let _ = std::fs::remove_dir_all(worktree_path);
    let _ = git(root, &["worktree", "prune"]);
    let _ = git(root, &["branch", "-D", branch]);
}

fn conflicted_paths(worktree: &Path) -> String {
    git(worktree, &["diff", "--name-only", "--diff-filter=U"])
        .map(|raw| {
            raw.lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default()
}

fn apply_snapshot(worktree: &Path, base: &str, snapshot_id: &str) -> Result<(), BootstrapError> {
    let applied = git(
        worktree,
        &[
            "-c",
            "merge.autoStash=false",
            "-c",
            "pull.rebase=false",
            "cherry-pick",
            "--no-commit",
            snapshot_id,
        ],
    );
    if let Err(error) = applied {
        let paths = conflicted_paths(worktree);
        if paths.is_empty() {
            return Err(snapshot::git_failure(error));
        }
        return Err(BootstrapError::ApplyConflict {
            base: base.to_string(),
            paths,
        });
    }
    run(worktree, &["reset", "-q"])?;
    Ok(())
}

pub(crate) fn prepare(args: PrepareArgs) -> Result<BootstrapPrepared, BootstrapError> {
    let root = repo_root(&args.project_path)?;
    if !is_safe_token(&args.project_key) {
        return Err(BootstrapError::InvalidInput(
            "the project key has characters that are not allowed".to_string(),
        ));
    }
    if !is_safe_branch(&args.base_branch) || !is_safe_branch(&args.branch_prefix) {
        return Err(BootstrapError::InvalidInput(
            "the branch names have characters that are not allowed".to_string(),
        ));
    }
    let slug = args
        .slug
        .clone()
        .unwrap_or_else(|| DEFAULT_SLUG.to_string());
    if !is_safe_token(&slug) {
        return Err(BootstrapError::InvalidInput(
            "the session name has characters that are not allowed".to_string(),
        ));
    }
    let _lock = MoveLock::acquire(&absolute_git_dir(&root)?)?;
    if let Some(operation) = in_progress_operation(&root) {
        return Err(BootstrapError::OperationInProgress(format!(
            "{operation:?}"
        )));
    }
    let unmerged = unmerged_count(&root);
    if unmerged > 0 {
        return Err(BootstrapError::Unmerged(unmerged));
    }
    let remote_ref = format!("refs/remotes/origin/{}", args.base_branch);
    if rev(&root, &format!("{remote_ref}^{{commit}}")).is_none() {
        return Err(BootstrapError::RemoteBranchMissing(
            args.base_branch.clone(),
        ));
    }
    let branch = format!("{}/{}", args.branch_prefix, slug);
    if rev(&root, &format!("refs/heads/{branch}")).is_some() {
        return Err(BootstrapError::BranchTaken(branch));
    }
    let snapshot_ref = format!("refs/goodboy/bootstrap/{}", args.project_key);
    let Some(snapshot) = take_snapshot(&root, &snapshot_ref)? else {
        return Err(BootstrapError::NothingToMove);
    };
    let changes = list_changes(&root, &snapshot.id)?;
    let nested = nested_repositories(&changes);
    if !nested.is_empty() {
        let _ = git(&root, &["update-ref", "-d", &snapshot_ref]);
        return Err(BootstrapError::NestedRepository(nested.join(", ")));
    }
    let sizes = object_sizes(&root, &changes)?;
    let mut size_iter = sizes.into_iter();
    let mut files: Vec<MovedFile> = Vec::new();
    for change in &changes {
        let size = if change.change == FileChange::Deleted {
            0
        } else {
            size_iter.next().unwrap_or(0)
        };
        files.push(MovedFile {
            path: change.path.clone(),
            change: change.change,
            size,
        });
    }
    let large_files: Vec<String> = files
        .iter()
        .filter(|file| file.size > LARGE_FILE_BYTES)
        .map(|file| file.path.clone())
        .collect();
    let created = worktree_create_blocking(CreateArgs {
        repo_path: args.project_path.trim().to_string(),
        branch_prefix: args.branch_prefix.clone(),
        slug: slug.clone(),
        parent_dir: None,
        existing_branch: None,
        fallback_ref: None,
        base_branch: Some(args.base_branch.clone()),
        dir_name: Some(slug.clone()),
    })
    .map_err(|error| BootstrapError::Git {
        message: crate::worktree::redact_credentials(&error.to_string()),
    })?;
    let worktree_path = PathBuf::from(&created.worktree_path);
    if created.reused {
        return Err(BootstrapError::InvalidInput(format!(
            "a worktree already exists at {}",
            created.worktree_path
        )));
    }
    let outcome = apply_snapshot(&worktree_path, &args.base_branch, &snapshot.id).and_then(|_| {
        let bad = verified_worktree(&root, &worktree_path, &changes)?;
        match bad.is_empty() {
            true => Ok(()),
            false => Err(BootstrapError::VerifyFailed(bad.join(", "))),
        }
    });
    if let Err(error) = outcome {
        remove_worktree(&root, &worktree_path, &created.branch_name);
        return Err(error);
    }
    let at_risk = ignored_files_at_risk(&root);
    Ok(BootstrapPrepared {
        snapshot_id: snapshot.id,
        snapshot_ref,
        worktree_path: created.worktree_path,
        branch: created.branch_name,
        base_branch: args.base_branch,
        files,
        large_files,
        ignored_at_risk: IgnoredAtRisk {
            count: at_risk.as_ref().map_or(0, |found| found.count),
            samples: at_risk.map(|found| found.samples).unwrap_or_default(),
        },
    })
}

pub(crate) fn rollback(
    project_path: &str,
    worktree_path: &str,
    branch: &str,
) -> Result<(), BootstrapError> {
    let root = repo_root(project_path)?;
    if !is_safe_branch(branch) {
        return Err(BootstrapError::InvalidInput(
            "the branch name has characters that are not allowed".to_string(),
        ));
    }
    let Some(target) = worktree_under_goodboy(&root, Path::new(worktree_path)) else {
        return Err(BootstrapError::InvalidInput(
            "the worktree is not inside the project's worktree folder".to_string(),
        ));
    };
    let _lock = MoveLock::acquire(&absolute_git_dir(&root)?)?;
    remove_worktree(&root, &target, branch);
    Ok(())
}

async fn blocking<T, F>(work: F) -> Result<T, BootstrapError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, BootstrapError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| BootstrapError::Io(std::io::Error::other(error.to_string())))?
}

#[tauri::command]
pub async fn bootstrap_prepare(args: PrepareArgs) -> Result<BootstrapPrepared, BootstrapError> {
    blocking(move || prepare(args)).await
}

#[tauri::command]
pub async fn bootstrap_clear_root(
    project_path: String,
    snapshot_id: String,
    worktree_path: String,
) -> Result<ClearReport, BootstrapError> {
    blocking(move || {
        let root = repo_root(&project_path)?;
        clear_root(&root, &snapshot_id, Path::new(&worktree_path))
    })
    .await
}

#[tauri::command]
pub async fn bootstrap_align_main(
    project_path: String,
    base_branch: String,
) -> Result<AlignOutcome, BootstrapError> {
    blocking(move || {
        let root = repo_root(&project_path)?;
        if !is_safe_branch(&base_branch) {
            return Err(BootstrapError::InvalidInput(
                "the branch name has characters that are not allowed".to_string(),
            ));
        }
        align_main(&root, &base_branch)
    })
    .await
}

#[tauri::command]
pub async fn bootstrap_recover(
    project_path: String,
    snapshot_id: String,
    worktree_path: String,
) -> Result<RecoverState, BootstrapError> {
    blocking(move || {
        let root = repo_root(&project_path)?;
        recover(&root, &snapshot_id, Path::new(&worktree_path))
    })
    .await
}

#[tauri::command]
pub async fn bootstrap_rollback(
    project_path: String,
    worktree_path: String,
    branch: String,
) -> Result<(), BootstrapError> {
    blocking(move || rollback(&project_path, &worktree_path, &branch)).await
}

#[cfg(test)]
mod tests;
