import { invoke } from '@tauri-apps/api/core';

export interface CreatedWorktree {
  readonly worktreePath: string;
  readonly branchName: string;
  readonly slug: string;
  readonly reused: boolean;
}

export interface WorktreeInfo {
  readonly path: string;
  readonly branch: string | null;
  readonly head: string;
  readonly isMain: boolean;
}

export interface CreateWorktreeArgs {
  readonly repoPath: string;
  readonly branchPrefix: string;
  readonly slug: string;
  readonly parentDir?: string;
}

export async function createWorktree(args: CreateWorktreeArgs): Promise<CreatedWorktree> {
  return invoke<CreatedWorktree>('worktree_create', { args });
}

export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await invoke('worktree_remove', { repoPath, worktreePath });
}

export async function listWorktrees(repoPath: string): Promise<ReadonlyArray<WorktreeInfo>> {
  return invoke<ReadonlyArray<WorktreeInfo>>('worktree_list', { repoPath });
}

export async function worktreeExists(
  repoPath: string,
  branchPrefix: string,
  slug: string,
): Promise<boolean> {
  return invoke<boolean>('worktree_exists', { repoPath, branchPrefix, slug });
}
