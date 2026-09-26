import { invoke } from '@tauri-apps/api/core';

export type BranchMergeState =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'protected' }
  | { readonly kind: 'merged-via-merge' }
  | { readonly kind: 'merged-via-rebase' }
  | { readonly kind: 'no-own-commits' }
  | { readonly kind: 'not-merged'; readonly ahead: number };

type BranchMergeStateParams = {
  readonly repoPath: string;
  readonly branch: string;
  readonly base?: string | null;
};

export const branchMergeState = async ({
  repoPath,
  branch,
  base = null,
}: BranchMergeStateParams): Promise<BranchMergeState> => {
  return invoke<BranchMergeState>('worktree_branch_merge_state', { repoPath, branch, base });
};
