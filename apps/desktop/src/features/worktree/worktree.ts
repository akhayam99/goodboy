import { invoke } from '@tauri-apps/api/core';
import type {
  BranchCommit,
  SessionId,
  WorkspaceId,
  WorktreeDetachAssessment,
  WorktreeDirectorySize,
  WorktreeDiffScope,
  WorktreeInspection,
  WorktreeRemovalMode,
  WorktreeRemovalReason,
  WorktreeRemovalResult,
  WorktreeStatus,
} from '@goodboy/types';

export type CreatedWorktree = {
  readonly worktreePath: string;
  readonly branchName: string;
  readonly slug: string;
  readonly reused: boolean;
};

export type CreateWorktreeArgs = {
  readonly repoPath: string;
  readonly branchPrefix: string;
  readonly slug: string;
  readonly parentDir?: string;
  readonly existingBranch?: string;
  readonly fallbackRef?: string;
  readonly baseBranch?: string;
  readonly dirName?: string;
};

export const createWorktree = async (args: CreateWorktreeArgs): Promise<CreatedWorktree> => {
  return invoke<CreatedWorktree>('worktree_create', { args });
};

type IntegrateCandidateParams = {
  readonly worktreePath: string;
  readonly candidateId: string;
  readonly candidateSha: string;
  readonly expectedHead: string;
};

type QuarantineCandidateParams = {
  readonly worktreePath: string;
  readonly candidateId: string;
  readonly baseSha: string;
};

export type QuarantinedCandidate = {
  readonly sha: string | null;
  readonly baseSha: string;
};

export const integrateWorktreeCandidate = async (
  args: IntegrateCandidateParams,
): Promise<string> => {
  const result = await invoke<{ readonly sha: string }>('worktree_integrate_candidate', { args });
  return result.sha;
};

export const quarantineWorktreeCandidate = async (
  args: QuarantineCandidateParams,
): Promise<QuarantinedCandidate> =>
  invoke<QuarantinedCandidate>('worktree_quarantine_candidate', { args });

export type ResolveCopy = {
  readonly copyPath: string;
  readonly head: string;
};

export const prepareResolveCopy = async (args: {
  readonly worktreePath: string;
  readonly attemptId: string;
}): Promise<ResolveCopy> => invoke<ResolveCopy>('resolve_copy_prepare', { args });

export type WorktreeWriterLease = {
  readonly path: string;
  readonly holder: string | null;
  readonly token: string | null;
  readonly runId: string | null;
  readonly isGranted: boolean;
  readonly hasExited: boolean;
  readonly waiting: ReadonlyArray<string>;
};

export type WorktreeWriterParams = {
  readonly path: string;
  readonly holder: string;
};

const freeLease = ({ path }: { readonly path: string }): WorktreeWriterLease => ({
  path,
  holder: null,
  token: null,
  runId: null,
  isGranted: false,
  hasExited: false,
  waiting: [],
});

const deniedLease = ({ path, holder }: WorktreeWriterParams): WorktreeWriterLease => ({
  path,
  holder,
  token: null,
  runId: null,
  isGranted: false,
  hasExited: false,
  waiting: [],
});

const grantedTokens = new Map<string, string>();

const tokenKey = ({ path, holder }: WorktreeWriterParams): string => `${path}\x00${holder}`;

export const holdsWorktreeWriter = ({ path, holder }: WorktreeWriterParams): boolean =>
  grantedTokens.has(tokenKey({ path, holder }));

export const acquireWorktreeWriter = async ({
  path,
  holder,
}: WorktreeWriterParams): Promise<WorktreeWriterLease> => {
  const key = tokenKey({ path, holder });
  const lease = await invoke<WorktreeWriterLease>('worktree_writer_acquire', {
    path,
    holder,
    token: grantedTokens.get(key) ?? null,
  }).catch(() => deniedLease({ path, holder }));
  if (lease.isGranted && lease.token !== null) {
    grantedTokens.set(key, lease.token);
  } else {
    grantedTokens.delete(key);
  }
  return lease;
};

export const releaseWorktreeWriter = async ({
  path,
  holder,
}: WorktreeWriterParams): Promise<WorktreeWriterLease> => {
  const key = tokenKey({ path, holder });
  const token = grantedTokens.get(key);
  if (token === undefined) {
    return freeLease({ path });
  }
  grantedTokens.delete(key);
  return invoke<WorktreeWriterLease>('worktree_writer_release', { path, holder, token }).catch(() =>
    freeLease({ path }),
  );
};

export const cancelWorktreeWriter = async ({
  path,
  holder,
}: WorktreeWriterParams): Promise<WorktreeWriterLease> => {
  grantedTokens.delete(tokenKey({ path, holder }));
  return invoke<WorktreeWriterLease>('worktree_writer_cancel', { path, holder }).catch(() =>
    freeLease({ path }),
  );
};

export const abandonWorktreeWriter = async ({
  path,
  holder,
}: WorktreeWriterParams): Promise<WorktreeWriterLease> => {
  grantedTokens.delete(tokenKey({ path, holder }));
  return invoke<WorktreeWriterLease>('worktree_writer_abandon', { path, holder }).catch(() =>
    freeLease({ path }),
  );
};

export const worktreeWriterStatus = async ({
  path,
}: {
  readonly path: string;
}): Promise<WorktreeWriterLease> => {
  return invoke<WorktreeWriterLease>('worktree_writer_status', { path }).catch(() =>
    freeLease({ path }),
  );
};

export type CreateSessionDirArgs = {
  readonly basePath: string;
  readonly slug: string;
  readonly directoryName?: string;
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const createSessionDir = async ({
  basePath,
  slug,
  directoryName,
  sessionId,
  workspaceId,
}: CreateSessionDirArgs): Promise<CreatedWorktree> => {
  return invoke<CreatedWorktree>('session_dir_create', {
    args: {
      basePath,
      slug,
      ...(directoryName != null ? { directoryName } : {}),
      sessionId,
      workspaceId,
    },
  });
};

type RemoveSessionDirectoryParams = {
  readonly basePath: string;
  readonly path: string;
};

export const removeSessionDirectory = async ({
  basePath,
  path,
}: RemoveSessionDirectoryParams): Promise<void> => {
  await invoke('session_dir_remove', { args: { basePath, path } });
};

type SessionDirExistsParams = {
  readonly path: string;
};

export const sessionDirExists = async ({ path }: SessionDirExistsParams): Promise<boolean> => {
  return invoke<boolean>('session_dir_exists', { path });
};

type ScratchDirParams = {
  readonly sessionId: SessionId;
};

export const scratchDirPrepare = async ({ sessionId }: ScratchDirParams): Promise<string> => {
  return invoke<string>('scratch_dir_prepare', { sessionId });
};

export const scratchDirRemove = async ({ sessionId }: ScratchDirParams): Promise<void> => {
  await invoke('scratch_dir_remove', { sessionId });
};

type WorktreePathParams = {
  readonly repoPath: string;
  readonly worktreePath: string;
};

export const inspectWorktree = async ({
  repoPath,
  worktreePath,
}: WorktreePathParams): Promise<WorktreeInspection> => {
  return invoke<WorktreeInspection>('worktree_inspect', { repoPath, worktreePath });
};

type RemoveWorktreeCheckedParams = WorktreePathParams & {
  readonly mode: WorktreeRemovalMode;
};

export const removeWorktreeChecked = async ({
  repoPath,
  worktreePath,
  mode,
}: RemoveWorktreeCheckedParams): Promise<WorktreeRemovalResult> => {
  return invoke<WorktreeRemovalResult>('worktree_remove_checked', {
    repoPath,
    worktreePath,
    mode,
  });
};

type DetachAssessmentParams = {
  readonly worktreePath: string;
  readonly baseBranch: string | null;
};

export const worktreeDetachAssessment = async ({
  worktreePath,
  baseBranch,
}: DetachAssessmentParams): Promise<WorktreeDetachAssessment> => {
  return invoke<WorktreeDetachAssessment>('worktree_detach_assessment', {
    worktreePath,
    baseBranch,
  });
};

export const gitCommonDirectory = async ({
  repoPath,
}: {
  readonly repoPath: string;
}): Promise<string | null> => {
  return invoke<string | null>('worktree_git_common_dir', { repoPath });
};

type WorktreeDirectorySizeParams = {
  readonly path: string;
};

export const worktreeDirectorySize = async ({
  path,
}: WorktreeDirectorySizeParams): Promise<WorktreeDirectorySize> => {
  return invoke<WorktreeDirectorySize>('worktree_directory_size', { path });
};

type TidyRepoGoodboyDirParams = {
  readonly repoPath: string;
};

export const tidyRepoGoodboyDir = async ({ repoPath }: TidyRepoGoodboyDirParams): Promise<void> => {
  await invoke('worktree_tidy_goodboy', { repoPath });
};

export type OrphanWorktree = {
  readonly path: string;
  readonly name: string;
  readonly isRegistered: boolean;
};

type ScanOrphanWorktreesParams = {
  readonly repoPath: string;
  readonly knownPaths: ReadonlyArray<string>;
};

export const scanOrphanWorktrees = async ({
  repoPath,
  knownPaths,
}: ScanOrphanWorktreesParams): Promise<ReadonlyArray<OrphanWorktree>> => {
  return invoke<ReadonlyArray<OrphanWorktree>>('worktree_orphans', { repoPath, knownPaths });
};

type RemoveWorktreeFolderParams = {
  readonly repoPath: string;
  readonly path: string;
  readonly mode: WorktreeRemovalMode;
  readonly allowLocalCommits?: boolean;
};

export const removeWorktreeFolder = async ({
  repoPath,
  path,
  mode,
  allowLocalCommits = false,
}: RemoveWorktreeFolderParams): Promise<WorktreeRemovalResult> => {
  return invoke<WorktreeRemovalResult>('worktree_folder_remove', {
    repoPath,
    path,
    mode,
    allowLocalCommits,
  });
};

export type WorktreeFolderFacts = {
  readonly path: string;
  readonly exists: boolean;
  readonly isRegistered: boolean;
  readonly branch: string | null;
  readonly lastCommitAt: number | null;
  readonly localOnlyCommits: number | null;
  readonly changedFiles: number;
  readonly changedSample: string | null;
  readonly reasons: ReadonlyArray<WorktreeRemovalReason>;
};

export type WorktreeFolderFactsRequest = {
  readonly repoRoot: string;
  readonly path: string;
};

type WorktreeFolderFactsParams = {
  readonly requests: ReadonlyArray<WorktreeFolderFactsRequest>;
};

export const worktreeFolderFacts = async ({
  requests,
}: WorktreeFolderFactsParams): Promise<ReadonlyArray<WorktreeFolderFacts>> => {
  if (requests.length === 0) {
    return [];
  }
  return invoke<ReadonlyArray<WorktreeFolderFacts>>('worktree_folder_facts', { requests });
};

export type DiskFree = {
  readonly freeBytes: number | null;
  readonly totalBytes: number | null;
};

type DiskFreeParams = {
  readonly path: string;
};

export const diskFree = async ({ path }: DiskFreeParams): Promise<DiskFree> => {
  return invoke<DiskFree>('disk_free', { path });
};

type WorktreeBaseParams = {
  readonly worktreePath: string;
  readonly baseBranch?: string;
};

export const worktreeDiff = async ({
  worktreePath,
  baseBranch,
}: WorktreeBaseParams): Promise<string> => {
  return invoke<string>('worktree_diff', { worktreePath, baseBranch: baseBranch ?? null });
};

type WorktreeDiffFileParams = WorktreeBaseParams & {
  readonly path: string;
};

export const worktreeDiffFile = async ({
  worktreePath,
  path,
  baseBranch,
}: WorktreeDiffFileParams): Promise<string> => {
  return invoke<string>('worktree_diff_file', {
    worktreePath,
    baseBranch: baseBranch ?? null,
    path,
  });
};

export const worktreeRemoteUrl = async (repoPath: string): Promise<string | null> => {
  return invoke<string | null>('worktree_remote_url', { repoPath });
};

export type ChangedFilesSummary = {
  readonly paths: ReadonlyArray<string>;
  readonly additions: number;
  readonly deletions: number;
  // Raw per-file numstat lines ("<adds>\t<dels>\t<path>", binary: "-\t-\t<path>")
  // for the same change set, including untracked files. Mirrored to the
  // `files_touched_numstat` context slot.
  readonly numstat: string;
};

export const worktreeChangedFiles = async ({
  worktreePath,
  baseBranch,
}: WorktreeBaseParams): Promise<ChangedFilesSummary> => {
  return invoke<ChangedFilesSummary>('worktree_changed_files', {
    worktreePath,
    baseBranch: baseBranch ?? null,
  });
};

export const listBranchCommits = async (
  worktreePath: string,
): Promise<ReadonlyArray<BranchCommit>> => {
  return invoke<ReadonlyArray<BranchCommit>>('worktree_commits', { worktreePath });
};

export type IsAncestorParams = {
  readonly worktreePath: string;
  readonly sha: string;
  readonly head: string;
};

export const worktreeIsAncestor = async ({
  worktreePath,
  sha,
  head,
}: IsAncestorParams): Promise<boolean> => {
  return invoke<boolean>('worktree_is_ancestor', { worktreePath, sha, head });
};

type AbortRebaseParams = {
  readonly worktreePath: string;
};

export const worktreeAbortRebase = async ({ worktreePath }: AbortRebaseParams): Promise<void> => {
  await invoke<void>('worktree_abort_rebase', { worktreePath });
};

export type RangeCommit = { readonly sha: string; readonly subject: string };

export type CommitRangeParams = {
  readonly worktreePath: string;
  readonly base: string;
  readonly head: string;
};

export const worktreeCommitRange = async ({
  worktreePath,
  base,
  head,
}: CommitRangeParams): Promise<ReadonlyArray<RangeCommit>> => {
  return invoke<ReadonlyArray<RangeCommit>>('worktree_commit_range', { worktreePath, base, head });
};

export type BlameLineParams = {
  readonly worktreePath: string;
  readonly path: string;
  readonly line: number;
};

export const worktreeBlameLine = async ({
  worktreePath,
  path,
  line,
}: BlameLineParams): Promise<string | null> => {
  return invoke<string | null>('worktree_blame_line', { worktreePath, path, line });
};

export type RemoteHeadParams = { readonly worktreePath: string; readonly branch: string };

export const worktreeRemoteHead = async ({
  worktreePath,
  branch,
}: RemoteHeadParams): Promise<string | null> => {
  return invoke<string | null>('worktree_remote_head', { worktreePath, branch });
};

export const worktreeDiffCommit = async (worktreePath: string, sha: string): Promise<string> => {
  return invoke<string>('worktree_diff_commit', { worktreePath, sha });
};

export type DiffRangeParams = {
  readonly worktreePath: string;
  readonly base: string;
  readonly head: string;
};

export const worktreeDiffRange = async ({
  worktreePath,
  base,
  head,
}: DiffRangeParams): Promise<string> => {
  return invoke<string>('worktree_diff_range', { worktreePath, base, head });
};

export type ScratchAddParams = {
  readonly worktreePath: string;
  readonly sha: string;
  readonly slug: string;
};

export const worktreeScratchAdd = async ({
  worktreePath,
  sha,
  slug,
}: ScratchAddParams): Promise<string> => {
  return invoke<string>('worktree_scratch_add', { worktreePath, sha, slug });
};

export type ScratchRemoveParams = {
  readonly worktreePath: string;
  readonly scratchPath: string;
};

export const worktreeScratchRemove = async ({
  worktreePath,
  scratchPath,
}: ScratchRemoveParams): Promise<void> => {
  return invoke<void>('worktree_scratch_remove', { worktreePath, scratchPath });
};

export const worktreeDiffWorking = async (
  worktreePath: string,
  scope: WorktreeDiffScope,
): Promise<string> => {
  return invoke<string>('worktree_diff_working', { worktreePath, scope });
};

type SyncBranchRefParams = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly expectedSha: string;
  readonly workspaceId: WorkspaceId;
  readonly projectId: string;
};

export const worktreeSyncBranchRef = async ({
  worktreePath,
  branch,
  expectedSha,
  workspaceId,
  projectId,
}: SyncBranchRefParams): Promise<boolean> =>
  invoke<boolean>('worktree_sync_branch_ref', {
    worktreePath,
    branch,
    expectedSha,
    workspaceId,
    projectId,
  });

type OriginBranchParams = {
  readonly worktreePath: string;
  readonly branch: string;
};

export type OriginFetch = {
  readonly fetched: boolean;
  readonly error: string | null;
  readonly remoteHead: string | null;
};

type FetchOriginBranchParams = OriginBranchParams & {
  readonly workspaceId?: WorkspaceId;
  readonly projectId?: string;
};

export const worktreeFetchOriginBranch = async ({
  worktreePath,
  branch,
  workspaceId,
  projectId,
}: FetchOriginBranchParams): Promise<OriginFetch> =>
  invoke<OriginFetch>('worktree_fetch_origin_branch', {
    worktreePath,
    branch,
    workspaceId,
    projectId,
  });

export type FixOnOrigin = {
  readonly onOrigin: boolean;
  readonly landedAs: string | null;
};

export const worktreeFixOnOrigin = async ({
  worktreePath,
  branch,
  sha,
}: OriginBranchParams & { readonly sha: string }): Promise<FixOnOrigin> =>
  invoke<FixOnOrigin>('worktree_fix_on_origin', { worktreePath, branch, sha });

export type FixLocation = {
  readonly isKnown: boolean;
  readonly landedAs: string | null;
  readonly pathExists: boolean | null;
};

export const worktreeLocateFix = async ({
  worktreePath,
  sha,
  path = null,
}: {
  readonly worktreePath: string;
  readonly sha: string;
  readonly path?: string | null;
}): Promise<FixLocation> => invoke<FixLocation>('worktree_locate_fix', { worktreePath, sha, path });

export type OriginCommit = {
  readonly sha: string;
  readonly author: string;
  readonly email: string;
  readonly subject: string;
  readonly committedAt: number;
};

type OriginCommitsTouchingParams = OriginBranchParams & {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly sinceSecs: number;
};

export const worktreeOriginCommitsTouching = async ({
  worktreePath,
  branch,
  path,
  startLine,
  endLine,
  sinceSecs,
}: OriginCommitsTouchingParams): Promise<ReadonlyArray<OriginCommit>> =>
  invoke<ReadonlyArray<OriginCommit>>('worktree_origin_commits_touching', {
    worktreePath,
    branch,
    path,
    startLine,
    endLine,
    sinceSecs,
  });

export const worktreeStatus = async ({
  worktreePath,
  baseBranch,
}: WorktreeBaseParams): Promise<WorktreeStatus> => {
  return invoke<WorktreeStatus>('worktree_status', {
    worktreePath,
    baseBranch: baseBranch ?? null,
  });
};

export type LocalBranchInfo = {
  readonly name: string;
  readonly inUse: boolean;
  readonly hasUncommitted: boolean;
};

const localBranchesCache = new Map<string, ReadonlyArray<LocalBranchInfo>>();

export const getCachedLocalBranches = (
  repoPath: string,
): ReadonlyArray<LocalBranchInfo> | undefined => localBranchesCache.get(repoPath);

export const invalidateLocalBranchesCache = (repoPath: string): void => {
  localBranchesCache.delete(repoPath);
};

export const listLocalBranches = async (
  repoPath: string,
): Promise<ReadonlyArray<LocalBranchInfo>> => {
  const branches = await invoke<ReadonlyArray<LocalBranchInfo>>('worktree_list_local_branches', {
    repoPath,
  });
  localBranchesCache.set(repoPath, branches);
  return branches;
};

type ListBranchNamesParams = {
  readonly repoPath: string;
};

export const listBranchNames = async ({
  repoPath,
}: ListBranchNamesParams): Promise<ReadonlyArray<string>> => {
  return invoke<ReadonlyArray<string>>('worktree_list_branch_names', { repoPath });
};

type RepoDefaultBaseBranchParams = {
  readonly repoPath: string;
};

export const repoDefaultBaseBranch = async ({
  repoPath,
}: RepoDefaultBaseBranchParams): Promise<string | null> => {
  return invoke<string | null>('worktree_repo_default_base_branch', { repoPath });
};

export type BranchMergeState =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'protected' }
  | { readonly kind: 'merged-via-merge' }
  | { readonly kind: 'merged-via-rebase' }
  | { readonly kind: 'merged-via-pr' }
  | { readonly kind: 'merged-then'; readonly newCommits: number }
  | { readonly kind: 'no-own-commits' }
  | { readonly kind: 'not-merged'; readonly ahead: number };

type BranchMergeStateParams = {
  readonly repoPath: string;
  readonly branch: string;
  readonly base?: string | null;
  readonly mergedHead?: string | null;
};

export const branchMergeState = async ({
  repoPath,
  branch,
  base = null,
  mergedHead = null,
}: BranchMergeStateParams): Promise<BranchMergeState> => {
  return invoke<BranchMergeState>('worktree_branch_merge_state', {
    repoPath,
    branch,
    base,
    mergedHead,
  });
};
export type ChangeBranchArgs = {
  readonly repoPath: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly createNew: boolean;
};

export const changeWorktreeBranch = async (args: ChangeBranchArgs): Promise<void> => {
  await invoke('worktree_change_branch', { args });
};

type BranchHolderParams = {
  readonly repoPath: string;
  readonly branch: string;
};

export const worktreeBranchHolder = async ({
  repoPath,
  branch,
}: BranchHolderParams): Promise<string | null> => {
  return invoke<string | null>('worktree_branch_holder', { repoPath, branch });
};
