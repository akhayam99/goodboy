import { invoke } from '@tauri-apps/api/core';
import type {
  BranchCommit,
  SessionId,
  WorkspaceId,
  WorktreeDiffScope,
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

export type CreateSessionDirArgs = {
  readonly basePath: string;
  readonly slug: string;
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const createSessionDir = async ({
  basePath,
  slug,
  sessionId,
  workspaceId,
}: CreateSessionDirArgs): Promise<CreatedWorktree> => {
  return invoke<CreatedWorktree>('session_dir_create', {
    args: { basePath, slug, sessionId, workspaceId },
  });
};

export type SimpleSessionScanEntry = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly path: string;
};

type ScanSimpleSessionsParams = {
  readonly rootPath: string;
};

export const scanSimpleSessions = async ({
  rootPath,
}: ScanSimpleSessionsParams): Promise<ReadonlyArray<SimpleSessionScanEntry>> => {
  return invoke<ReadonlyArray<SimpleSessionScanEntry>>('simple_sessions_scan', { rootPath });
};

type WriteSimpleSessionMarkerParams = {
  readonly path: string;
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const writeSimpleSessionMarker = async ({
  path,
  sessionId,
  workspaceId,
}: WriteSimpleSessionMarkerParams): Promise<void> => {
  await invoke('simple_session_marker_write', { path, sessionId, workspaceId });
};

type SimpleSessionDirExistsParams = {
  readonly path: string;
};

export const simpleSessionDirExists = async ({
  path,
}: SimpleSessionDirExistsParams): Promise<boolean> => {
  return invoke<boolean>('simple_session_dir_exists', { path });
};

export const removeWorktree = async (repoPath: string, worktreePath: string): Promise<void> => {
  await invoke('worktree_remove', { repoPath, worktreePath });
};

export type WorktreeEntry = {
  readonly path: string;
  readonly branch: string | null;
  readonly head: string;
  readonly isMain: boolean;
};

export const worktreeList = async (repoPath: string): Promise<ReadonlyArray<WorktreeEntry>> => {
  return invoke<ReadonlyArray<WorktreeEntry>>('worktree_list', { repoPath });
};

export const worktreeDiff = async (worktreePath: string, base?: string): Promise<string> => {
  return invoke<string>('worktree_diff', { worktreePath, base: base ?? null });
};

export const worktreeDiffFile = async (
  worktreePath: string,
  path: string,
  base?: string,
): Promise<string> => {
  return invoke<string>('worktree_diff_file', { worktreePath, base: base ?? null, path });
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

export const worktreeChangedFiles = async (
  worktreePath: string,
  base?: string,
): Promise<ChangedFilesSummary> => {
  return invoke<ChangedFilesSummary>('worktree_changed_files', {
    worktreePath,
    base: base ?? null,
  });
};

export const listBranchCommits = async (
  worktreePath: string,
): Promise<ReadonlyArray<BranchCommit>> => {
  return invoke<ReadonlyArray<BranchCommit>>('worktree_commits', { worktreePath });
};

export const worktreeDiffCommit = async (worktreePath: string, sha: string): Promise<string> => {
  return invoke<string>('worktree_diff_commit', { worktreePath, sha });
};

export const worktreeDiffWorking = async (
  worktreePath: string,
  scope: WorktreeDiffScope,
): Promise<string> => {
  return invoke<string>('worktree_diff_working', { worktreePath, scope });
};

export const worktreeStatus = async (worktreePath: string): Promise<WorktreeStatus> => {
  return invoke<WorktreeStatus>('worktree_status', { worktreePath });
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

export const listLocalBranches = async (
  repoPath: string,
): Promise<ReadonlyArray<LocalBranchInfo>> => {
  const branches = await invoke<ReadonlyArray<LocalBranchInfo>>('worktree_list_local_branches', {
    repoPath,
  });
  localBranchesCache.set(repoPath, branches);
  return branches;
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
