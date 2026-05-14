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
