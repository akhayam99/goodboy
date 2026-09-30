use crate::proc::git::GitError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum WorktreeError {
    #[error("repository not found: {0}")]
    RepoNotFound(String),
    #[error("no git repository at {0}. run git init in that folder, then start a session")]
    NoRepository(String),
    #[error(
        "the git repository at {0} has no commits yet. make the first commit, then start a session"
    )]
    NoCommit(String),
    #[error("git failed: {message}")]
    Git { message: String },
    #[error(
        "branch {branch} is already checked out at {path}. switch that worktree to another branch, or fork a new one instead"
    )]
    BranchInUse { branch: String, path: String },
    #[error(
        "branch {branch} exists neither in this repository nor on origin, so there is nothing to adopt. cut it as a new branch instead"
    )]
    BranchNotFound { branch: String },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid utf-8 in git output")]
    InvalidUtf8,
}

crate::util::impl_error_serialize!(WorktreeError);

impl From<GitError> for WorktreeError {
    fn from(error: GitError) -> Self {
        match error {
            GitError::Spawn(inner) => WorktreeError::Io(inner),
            GitError::InvalidUtf8 => WorktreeError::InvalidUtf8,
            other => WorktreeError::Git {
                message: other.to_string(),
            },
        }
    }
}

impl WorktreeError {
    fn kind(&self) -> &'static str {
        match self {
            WorktreeError::RepoNotFound(_) => "repo_not_found",
            WorktreeError::NoRepository(_) => "no_repository",
            WorktreeError::NoCommit(_) => "no_commit",
            WorktreeError::Git { .. } => "git",
            WorktreeError::BranchInUse { .. } => "branch_in_use",
            WorktreeError::BranchNotFound { .. } => "branch_not_found",
            WorktreeError::Io(_) => "io",
            WorktreeError::InvalidUtf8 => "invalid_utf8",
        }
    }
}
