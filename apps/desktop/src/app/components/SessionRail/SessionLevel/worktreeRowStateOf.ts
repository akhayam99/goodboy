import type { PullRequestChecks } from '@goodboy/types';

type Params = {
  readonly checks: PullRequestChecks;
  readonly behind: number | null;
  readonly conflicts: number | null;
  readonly isRebasing: boolean;
  readonly isDecisionWaiting: boolean;
  readonly commentsWaiting: number;
  readonly baseBranch: string | null;
};

export type WorktreeRowState = {
  readonly tone: 'danger' | 'warning' | null;
  readonly reason: string | null;
};

const FINE: WorktreeRowState = { tone: null, reason: null };

type PluralParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const plural = ({ count, one, many }: PluralParams): string =>
  `${count} ${count === 1 ? one : many}`;

export const worktreeRowStateOf = ({
  checks,
  behind,
  conflicts,
  isRebasing,
  isDecisionWaiting,
  commentsWaiting,
  baseBranch,
}: Params): WorktreeRowState => {
  if (checks === 'failure') {
    return { tone: 'danger', reason: 'A check failed' };
  }
  if (conflicts !== null && conflicts > 0) {
    return {
      tone: 'warning',
      reason: plural({ count: conflicts, one: 'conflict', many: 'conflicts' }),
    };
  }
  if (isRebasing) {
    return { tone: 'warning', reason: `Rebasing on ${baseBranch ?? 'main'}` };
  }
  if (behind !== null && behind > 0) {
    return { tone: 'warning', reason: `${behind} behind ${baseBranch ?? 'main'}` };
  }
  if (isDecisionWaiting) {
    return { tone: 'warning', reason: 'Needs a decision' };
  }
  if (commentsWaiting > 0) {
    return {
      tone: 'warning',
      reason: plural({
        count: commentsWaiting,
        one: 'comment waits for you',
        many: 'comments wait for you',
      }),
    };
  }
  return FINE;
};
