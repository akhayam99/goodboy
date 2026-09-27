import type { BranchLocation, ProjectBranch } from '../../worktree/branchCleanup';
import { mergedThenLabel } from '../../../shared/lib/mergedThen';
import { pluralize } from '../../../shared/utils/pluralize';

export const LOCATION_LABEL: Readonly<Record<BranchLocation, string>> = {
  'on-origin': 'On origin',
  'local-only': 'Local only',
  'gone-on-origin': 'Gone on origin',
};

export type VerdictCopy = {
  readonly label: string;
  readonly detail: string | null;
  readonly isSafe: boolean;
};

export const verdictCopy = ({
  branch,
  base,
}: {
  readonly branch: ProjectBranch;
  readonly base: string;
}): VerdictCopy => {
  const state = branch.mergeState;
  switch (state.kind) {
    case 'merged-via-merge':
      return { label: 'Safe to delete · merged', detail: 'merge commit', isSafe: true };
    case 'merged-via-rebase':
      return { label: 'Safe to delete · merged', detail: 'rebase', isSafe: true };
    case 'merged-via-pr':
      return { label: 'Safe to delete · merged', detail: 'pull request', isSafe: true };
    case 'merged-then':
      return {
        label: mergedThenLabel(state.newCommits),
        detail: null,
        isSafe: false,
      };
    case 'no-own-commits':
      return {
        label: 'Safe to delete · no commits',
        detail: 'created, never used',
        isSafe: true,
      };
    case 'not-merged':
      return {
        label: `Not merged · ${pluralize(state.ahead, 'commit')}`,
        detail:
          branch.behind !== null && branch.behind > 0
            ? `Behind ${base} by ${branch.behind.toLocaleString('en-US')}`
            : null,
        isSafe: false,
      };
    case 'protected':
      return { label: 'Protected', detail: null, isSafe: false };
    case 'unknown':
      return { label: "Couldn't check", detail: null, isSafe: false };
  }
};

export const BRANCHES_HELP = (base: string): string =>
  `Local branches only. Safe to delete means merged into ${base}, nothing new after the merge, no folder with changes, not held by another worktree.`;

export const branchCount = (count: number): string =>
  count === 1 ? '1 branch' : `${count} branches`;

export const deletedNotice = (count: number): string =>
  `Deleted ${branchCount(count)}. Each one can be restored for 14 days.`;
