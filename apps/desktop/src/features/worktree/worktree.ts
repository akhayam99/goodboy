import { invoke } from '@tauri-apps/api/core';
import type { BranchCommit, WorktreeDiffScope, WorktreeStatus } from '@goodboy/types';

export interface CreatedWorktree {
  readonly worktreePath: string;
  readonly branchName: string;
  readonly slug: string;
  readonly reused: boolean;
}

export interface CreateWorktreeArgs {
  readonly repoPath: string;
  readonly branchPrefix: string;
  readonly slug: string;
  readonly parentDir?: string;
  readonly existingBranch?: string;
}

export async function createWorktree(args: CreateWorktreeArgs): Promise<CreatedWorktree> {
  return invoke<CreatedWorktree>('worktree_create', { args });
}

export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await invoke('worktree_remove', { repoPath, worktreePath });
}

export async function worktreeDiff(worktreePath: string, base?: string): Promise<string> {
  return invoke<string>('worktree_diff', { worktreePath, base: base ?? null });
}

export interface ChangedFilesSummary {
  readonly paths: ReadonlyArray<string>;
  readonly additions: number;
  readonly deletions: number;
}

/**
 * Distinct file paths that differ vs the merge-base with `base` (default
 * "main"), plus aggregate line additions/deletions. Includes uncommitted +
 * untracked, stable across pushes.
 */
export async function worktreeChangedFiles(
  worktreePath: string,
  base?: string,
): Promise<ChangedFilesSummary> {
  return invoke<ChangedFilesSummary>('worktree_changed_files', {
    worktreePath,
    base: base ?? null,
  });
}

export async function listBranchCommits(
  worktreePath: string,
): Promise<ReadonlyArray<BranchCommit>> {
  return invoke<ReadonlyArray<BranchCommit>>('worktree_commits', { worktreePath });
}

export async function worktreeDiffCommit(worktreePath: string, sha: string): Promise<string> {
  return invoke<string>('worktree_diff_commit', { worktreePath, sha });
}

export async function worktreeDiffWorking(
  worktreePath: string,
  scope: WorktreeDiffScope,
): Promise<string> {
  return invoke<string>('worktree_diff_working', { worktreePath, scope });
}

export async function worktreeStatus(worktreePath: string): Promise<WorktreeStatus> {
  return invoke<WorktreeStatus>('worktree_status', { worktreePath });
}

export interface LocalBranchInfo {
  readonly name: string;
  readonly inUse: boolean;
  readonly hasUncommitted: boolean;
}

export async function listLocalBranches(repoPath: string): Promise<ReadonlyArray<LocalBranchInfo>> {
  return invoke<ReadonlyArray<LocalBranchInfo>>('worktree_list_local_branches', { repoPath });
}

export interface ChangeBranchArgs {
  readonly repoPath: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly createNew: boolean;
}

export async function changeWorktreeBranch(args: ChangeBranchArgs): Promise<void> {
  await invoke('worktree_change_branch', { args });
}
