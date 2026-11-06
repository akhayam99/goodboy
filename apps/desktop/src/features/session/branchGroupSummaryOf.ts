import type { BranchGroupCounts } from './branchGroupsOf';

type Params = {
  readonly counts: BranchGroupCounts;
  readonly fact: string | null;
};

export const branchGroupSummaryOf = ({ counts, fact }: Params): string =>
  [
    fact,
    counts.needsYou === 0
      ? null
      : `${counts.needsYou} ${counts.needsYou === 1 ? 'needs' : 'need'} you`,
    counts.running === 0 ? null : `${counts.running} running`,
    counts.finished === 0 ? null : `${counts.finished} finished`,
  ]
    .filter((part) => part !== null)
    .join(', ');
