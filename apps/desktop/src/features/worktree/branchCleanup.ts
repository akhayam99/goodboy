import { invoke } from '@tauri-apps/api/core';
import type { BranchMergeState } from './worktree';

export type BranchCleanupError =
  | { readonly kind: 'repo-not-found' }
  | { readonly kind: 'branch-missing' }
  | { readonly kind: 'sha-moved'; readonly actual: string }
  | { readonly kind: 'held-by-worktree'; readonly path: string }
  | { readonly kind: 'branch-exists' }
  | { readonly kind: 'git'; readonly message: string };

export type BranchDeleteOutcome = {
  readonly keepRef: string;
  readonly deletedOnOrigin: boolean;
  readonly originError: string | null;
};

export type BranchRestoreOutcome = {
  readonly pushedToOrigin: boolean;
  readonly originError: string | null;
};

type BranchDeleteArgs = {
  readonly repoRoot: string;
  readonly branch: string;
  readonly expectedSha: string;
  readonly alsoOrigin: boolean;
  readonly originLeaseSha?: string;
};

export const deleteBranchChecked = async (args: BranchDeleteArgs): Promise<BranchDeleteOutcome> =>
  invoke<BranchDeleteOutcome>('branch_delete_checked', { args });

type BranchRestoreArgs = {
  readonly repoRoot: string;
  readonly branch: string;
  readonly sha: string;
  readonly keepRef: string;
  readonly pushToOrigin: boolean;
};

export const restoreDeletedBranch = async (
  args: BranchRestoreArgs,
): Promise<BranchRestoreOutcome> => invoke<BranchRestoreOutcome>('branch_restore', { args });

type BranchForgetArgs = {
  readonly repoRoot: string;
  readonly keepRef: string;
  readonly sha: string;
};

export const forgetDeletedBranchRef = async (args: BranchForgetArgs): Promise<void> =>
  invoke<void>('branch_forget_deleted', { args });

type BranchHeadShaArgs = {
  readonly repoRoot: string;
  readonly branch: string;
};

export const branchHeadSha = async ({
  repoRoot,
  branch,
}: BranchHeadShaArgs): Promise<string | null> =>
  invoke<string | null>('branch_head_sha', { repoRoot, branch });

const BRANCH_CLEANUP_ERROR_KINDS: ReadonlySet<string> = new Set([
  'repo-not-found',
  'branch-missing',
  'sha-moved',
  'held-by-worktree',
  'branch-exists',
  'git',
]);

export const asBranchCleanupError = (error: unknown): BranchCleanupError | null => {
  if (typeof error !== 'object' || error === null || !('kind' in error)) {
    return null;
  }
  const kind = (error as { readonly kind: unknown }).kind;
  return typeof kind === 'string' && BRANCH_CLEANUP_ERROR_KINDS.has(kind)
    ? (error as BranchCleanupError)
    : null;
};

export const isMergedState = (state: BranchMergeState): boolean =>
  state.kind === 'merged-via-merge' ||
  state.kind === 'merged-via-rebase' ||
  state.kind === 'merged-via-squash';

export type BranchLocation = 'on-origin' | 'local-only' | 'gone-on-origin';

export type ProjectBranch = {
  readonly name: string;
  readonly sha: string;
  readonly authorEmail: string | null;
  readonly lastCommitAt: number | null;
  readonly location: BranchLocation;
  readonly mergeState: BranchMergeState;
  readonly behind: number | null;
};

export type ProjectBranchScan = {
  readonly userEmail: string | null;
  readonly branches: ReadonlyArray<ProjectBranch>;
};

type ProjectBranchesArgs = {
  readonly repoRoot: string;
  readonly base: string | null;
};

export const listProjectBranches = async ({
  repoRoot,
  base,
}: ProjectBranchesArgs): Promise<ProjectBranchScan> =>
  invoke<ProjectBranchScan>('project_branches', { repoRoot, base });
