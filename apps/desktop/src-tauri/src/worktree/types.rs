use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct CreatedWorktree {
    #[serde(rename = "worktreePath")]
    pub worktree_path: String,
    #[serde(rename = "branchName")]
    pub branch_name: String,
    pub slug: String,
    pub reused: bool,
    #[serde(rename = "trackedRemote")]
    pub tracked_remote: bool,
}

#[derive(Debug, Serialize)]
pub struct WorktreeInfo {
    pub path: String,
    pub branch: Option<String>,
    pub head: String,
    #[serde(rename = "isMain")]
    pub is_main: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum WorktreeInspection {
    Missing {
        path: String,
    },
    Registered {
        path: String,
        #[serde(rename = "isMain")]
        is_main: bool,
        #[serde(rename = "isLocked")]
        is_locked: bool,
        #[serde(rename = "lockReason")]
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
#[serde(tag = "kind", rename_all = "kebab-case")]
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
        #[serde(rename = "hasUpstream")]
        has_upstream: bool,
        #[serde(rename = "affectedFiles")]
        affected_files: u32,
        #[serde(rename = "localOnlyCommits")]
        local_only_commits: u32,
        #[serde(rename = "ignoredFiles")]
        ignored_files: u32,
        #[serde(rename = "ignoredFileSamples")]
        ignored_file_samples: Vec<String>,
        integration: BranchIntegration,
    },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct WorktreeDirectorySize {
    pub path: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: Option<u64>,
    #[serde(rename = "isPartial")]
    pub is_partial: bool,
    pub exists: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateArgs {
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "branchName")]
    pub branch_name: String,
    #[serde(rename = "parentDir")]
    pub parent_dir: Option<String>,
    #[serde(rename = "existingBranch", default)]
    pub existing_branch: Option<String>,
    #[serde(rename = "fallbackRef", default)]
    pub fallback_ref: Option<String>,
    /// Base branch to cut a new branch from. Defaults to `main`. The branch is
    /// always cut from `origin/<base>` (not the local copy) so a stale local
    /// `main` cannot leak unrelated commits into the new branch. Ignored when
    /// `existing_branch` is set.
    #[serde(rename = "baseBranch", default)]
    pub base_branch: Option<String>,
    #[serde(rename = "dirName", default)]
    pub dir_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BranchInfo {
    pub name: String,
    /// True when this branch is currently checked out in some worktree.
    #[serde(rename = "inUse")]
    pub in_use: bool,
    /// True when the branch has uncommitted changes in its checkout.
    #[serde(rename = "hasUncommitted")]
    pub has_uncommitted: bool,
}

#[derive(Debug, Serialize)]
pub struct RemoteBranchInfo {
    pub name: String,
    pub author: String,
    pub sha: String,
    pub timestamp: i64,
    #[serde(rename = "hasLocal")]
    pub has_local: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct RemoteBranchState {
    #[serde(rename = "remoteAhead")]
    pub remote_ahead: u32,
    #[serde(rename = "localOwn")]
    pub local_own: u32,
    #[serde(rename = "remoteContainsLocal")]
    pub remote_contains_local: bool,
    #[serde(rename = "remoteSha")]
    pub remote_sha: String,
    #[serde(rename = "localSha")]
    pub local_sha: String,
}

#[derive(Debug, Serialize)]
pub struct ChangedBranch {
    pub adopted: bool,
}

#[derive(Debug, Deserialize)]
pub struct ChangeBranchArgs {
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "worktreePath")]
    pub worktree_path: String,
    pub branch: String,
    /// When true, create the branch with `git switch -c`. When false, switch to
    /// an existing branch with `git switch`.
    #[serde(rename = "createNew")]
    pub create_new: bool,
}

#[derive(Debug, Deserialize)]
pub struct IntegrateCandidateArgs {
    #[serde(rename = "worktreePath")]
    pub worktree_path: String,
    #[serde(rename = "candidateId")]
    pub candidate_id: String,
    #[serde(rename = "candidateSha")]
    pub candidate_sha: String,
    #[serde(rename = "expectedHead")]
    pub expected_head: String,
}

#[derive(Debug, Deserialize)]
pub struct QuarantineCandidateArgs {
    #[serde(rename = "worktreePath")]
    pub worktree_path: String,
    #[serde(rename = "candidateId")]
    pub candidate_id: String,
    #[serde(rename = "baseSha")]
    pub base_sha: String,
    #[serde(default)]
    pub stack: bool,
}

#[derive(Debug, Deserialize)]
pub struct SplitCandidatePick {
    #[serde(rename = "candidateId")]
    pub candidate_id: String,
    #[serde(rename = "commitSha")]
    pub commit_sha: String,
}

#[derive(Debug, Deserialize)]
pub struct SplitCandidatesArgs {
    #[serde(rename = "worktreePath")]
    pub worktree_path: String,
    #[serde(rename = "baseSha")]
    pub base_sha: String,
    pub picks: Vec<SplitCandidatePick>,
    #[serde(default)]
    pub stack: bool,
}

#[derive(Debug, Serialize)]
pub struct SplitCandidate {
    #[serde(rename = "candidateId")]
    pub candidate_id: String,
    pub sha: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct IntegratedCandidate {
    pub sha: String,
}

#[derive(Debug, Serialize)]
pub struct QuarantinedCandidate {
    pub sha: Option<String>,
    #[serde(rename = "baseSha")]
    pub base_sha: String,
}

#[derive(Debug, Serialize)]
pub struct BranchCommit {
    pub sha: String,
    #[serde(rename = "shortSha")]
    pub short_sha: String,
    pub subject: String,
    pub author: String,
    pub timestamp: i64,
    pub pushed: bool,
    #[serde(rename = "parentSha")]
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
pub struct WorktreeStatus {
    pub branch: Option<String>,
    pub head: Option<String>,
    #[serde(rename = "headSubject")]
    pub head_subject: Option<String>,
    #[serde(rename = "upstreamDistance")]
    pub upstream_distance: GitDistance,
    #[serde(rename = "mainDistance")]
    pub main_distance: GitDistance,
    #[serde(rename = "workingTree")]
    pub working_tree: GitWorkingTree,
    #[serde(rename = "upstream")]
    pub upstream: Option<String>,
    #[serde(rename = "inProgress")]
    pub in_progress: Option<GitOperation>,
}
