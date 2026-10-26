use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedWorktree {
    pub worktree_path: String,
    pub branch_name: String,
    pub slug: String,
    pub reused: bool,
    pub tracked_remote: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: Option<String>,
    pub head: String,
    pub is_main: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum WorktreeInspection {
    Missing {
        path: String,
    },
    Registered {
        path: String,
        is_main: bool,
        is_locked: bool,
        lock_reason: Option<String>,
    },
    ForeignDirectory {
        path: String,
    },
    RepositoryUnavailable {
        path: String,
    },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum WorktreeRemovalReason {
    RepositoryUnavailable,
    MainCheckout,
    UnexpectedDirectory,
    DifferentRepository,
    Locked,
    StatusUnavailable,
    StagedChanges,
    UnstagedChanges,
    UntrackedFiles,
    UnmergedConflicts,
    OperationInProgress,
    WriterLeaseHeld,
    NotRegistered,
    OutsideWorktreeFolder,
    UnpushedCommits,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum FolderVerdict {
    Safe,
    Dirty,
    Writing,
    Operation,
    NotTracked,
    Unavailable,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum WorktreeRestoreRefusal {
    OutsideWorktreeFolder,
    PathTaken,
    BranchMissing,
    BranchInUse,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum WorktreeRestoreResult {
    Restored {
        path: String,
    },
    Refused {
        path: String,
        reason: WorktreeRestoreRefusal,
    },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum WorktreeRemovalResult {
    Removed {
        path: String,
    },
    Missing {
        path: String,
    },
    Kept {
        path: String,
        reasons: Vec<WorktreeRemovalReason>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WorktreeRemovalMode {
    Safe,
    Confirmed,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum BranchIntegration {
    Unknown,
    Merged { base: String },
    Unmerged { base: String, ahead: u32 },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum WorktreeDetachAssessment {
    Missing {
        path: String,
    },
    Unavailable {
        path: String,
        branch: Option<String>,
    },
    Assessed {
        path: String,
        branch: Option<String>,
        has_upstream: bool,
        affected_files: u32,
        local_only_commits: u32,
        ignored_files: u32,
        ignored_file_samples: Vec<String>,
        integration: BranchIntegration,
    },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeDirectorySize {
    pub path: String,
    pub size_bytes: Option<u64>,
    pub is_partial: bool,
    pub exists: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateArgs {
    pub repo_path: String,
    pub branch_name: String,
    pub parent_dir: Option<String>,
    #[serde(default)]
    pub existing_branch: Option<String>,
    #[serde(default)]
    pub fallback_ref: Option<String>,
    /// Base branch to cut a new branch from. Defaults to `main`. The branch is
    /// always cut from `origin/<base>` (not the local copy) so a stale local
    /// `main` cannot leak unrelated commits into the new branch. Ignored when
    /// `existing_branch` is set.
    #[serde(default)]
    pub base_branch: Option<String>,
    #[serde(default)]
    pub dir_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    /// True when this branch is currently checked out in some worktree.
    pub in_use: bool,
    /// True when the branch has uncommitted changes in its checkout.
    pub has_uncommitted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBranchInfo {
    pub name: String,
    pub author: String,
    pub sha: String,
    pub timestamp: i64,
    pub has_local: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteBranchState {
    pub remote_ahead: u32,
    pub local_own: u32,
    pub remote_contains_local: bool,
    pub remote_sha: String,
    pub local_sha: String,
}

#[derive(Debug, Serialize)]
pub struct ChangedBranch {
    pub adopted: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeBranchArgs {
    pub repo_path: String,
    pub worktree_path: String,
    pub branch: String,
    /// When true, create the branch with `git switch -c`. When false, switch to
    /// an existing branch with `git switch`.
    pub create_new: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrateCandidateArgs {
    pub worktree_path: String,
    pub candidate_id: String,
    pub candidate_sha: String,
    pub expected_head: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineCandidateArgs {
    pub worktree_path: String,
    pub candidate_id: String,
    pub base_sha: String,
    #[serde(default)]
    pub stack: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitCandidatePick {
    pub candidate_id: String,
    pub commit_sha: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitCandidatesArgs {
    pub worktree_path: String,
    pub base_sha: String,
    pub picks: Vec<SplitCandidatePick>,
    #[serde(default)]
    pub stack: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitCandidate {
    pub candidate_id: String,
    pub sha: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct IntegratedCandidate {
    pub sha: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantinedCandidate {
    pub sha: Option<String>,
    pub base_sha: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchCommit {
    pub sha: String,
    pub short_sha: String,
    pub subject: String,
    pub author: String,
    pub timestamp: i64,
    pub pushed: bool,
    pub parent_sha: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitUnknownReason {
    NoUpstream,
    DetachedHead,
    RevListFailed,
    MainRefUnresolved,
    StatusReadFailed,
    UpstreamGone,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum GitDistance {
    Known { ahead: u32, behind: u32 },
    Unknown { reason: GitUnknownReason },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum GitWorkingTree {
    Known {
        staged: u32,
        unstaged: u32,
        untracked: u32,
        unmerged: u32,
        changed: u32,
    },
    Unknown {
        reason: GitUnknownReason,
    },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GitOperation {
    Merge,
    Rebase,
    CherryPick,
    Bisect,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeStatus {
    pub branch: Option<String>,
    pub head: Option<String>,
    pub head_subject: Option<String>,
    pub upstream_distance: GitDistance,
    pub main_distance: GitDistance,
    pub working_tree: GitWorkingTree,
    pub upstream: Option<String>,
    pub in_progress: Option<GitOperation>,
}

#[cfg(test)]
mod wire_shape;
