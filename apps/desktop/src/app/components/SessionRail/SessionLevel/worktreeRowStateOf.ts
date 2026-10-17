import type { PullRequestChecks } from '@goodboy/types';

export type EntryShownFact = 'checks' | 'comments';

type Params = {
  readonly checks: PullRequestChecks;
  readonly behind: number | null;
  readonly conflicts: number | null;
  readonly isRebasing: boolean;
  readonly isDecisionWaiting: boolean;
  readonly commentsWaiting: number;
  readonly baseBranch: string | null;
  readonly shownByEntries?: ReadonlySet<EntryShownFact>;
};

export type WorktreeRowState = {
  readonly tone: 'danger' | 'warning' | null;
  readonly reason: string | null;
};

const FINE: WorktreeRowState = { tone: null, reason: null };

const NONE_SHOWN: ReadonlySet<EntryShownFact> = new Set<EntryShownFact>();

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
  shownByEntries = NONE_SHOWN,
}: Params): WorktreeRowState => {
  if (checks === 'failure' && !shownByEntries.has('checks')) {
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
  if (commentsWaiting > 0 && !shownByEntries.has('comments')) {
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
