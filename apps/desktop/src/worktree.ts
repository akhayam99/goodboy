import { invoke } from '@tauri-apps/api/core';

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
