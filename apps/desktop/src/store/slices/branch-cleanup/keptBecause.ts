import type { BranchMergeState } from '../../../features/worktree/worktree';
import type { BranchCleanupError } from '../../../features/worktree/branchCleanup';
import { pluralize } from '../../../shared/utils/pluralize';

type MergeParams = {
  readonly branch: string;
  readonly state: BranchMergeState;
};

const commits = (count: number): string => pluralize(count, 'new commit');

export const keptBecauseOfMerge = ({ branch, state }: MergeParams): string | null => {
  switch (state.kind) {
    case 'merged-via-merge':
    case 'merged-via-rebase':
    case 'merged-via-pr':
    case 'no-own-commits':
      return null;
    case 'merged-then':
      return `Kept ${branch}: ${commits(state.newCommits)} after the merge.`;
    case 'not-merged':
      return `Kept ${branch}: ${pluralize(state.ahead, 'commit')} not in the base branch.`;
    case 'protected':
      return `Kept ${branch}: it is a protected branch.`;
    case 'unknown':
      return `Kept ${branch}: couldn't check the merge.`;
  }
};

type ErrorParams = {
  readonly branch: string;
  readonly error: BranchCleanupError | null;
};

export const keptBecauseOfError = ({ branch, error }: ErrorParams): string => {
  switch (error?.kind) {
    case 'sha-moved':
      return `Kept ${branch}: it moved while Goodboy checked it.`;
    case 'held-by-worktree':
      return `Kept ${branch}: another folder has it checked out.`;
    case 'branch-missing':
      return `Kept ${branch}: it is already gone on this Mac.`;
    default:
      return `Kept ${branch}: git refused to delete it.`;
  }
};

export const keptBecauseNotCreated = ({ branch }: { readonly branch: string }): string =>
  `Kept ${branch}: Goodboy didn't create it.`;

export const keptBecauseFolder = ({
  branch,
  reason,
}: {
  readonly branch: string;
  readonly reason: string | null;
}): string =>
  reason === null ? `Kept ${branch}: its folder couldn't be removed.` : `Kept ${branch}: ${reason}`;
