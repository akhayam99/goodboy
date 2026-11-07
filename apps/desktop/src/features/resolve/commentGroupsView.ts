import { isSettledWord } from './commentStates';
import { reviewCounts } from './reviewCounts';
import type { ReviewEntry, ReviewGroup } from './components/ReviewFlow/useReviewEntries';
import type { CommentScope, CommentState } from './components/ReviewFlow/ReviewScopeBar';

type ViewParams = {
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly scope: CommentScope;
  readonly state: CommentState;
};

export type CommentStateCounts = {
  readonly open: number;
  readonly resolved: number;
  readonly needYou: number;
};

type EntriesParams = {
  readonly entries: ReadonlyArray<ReviewEntry>;
};

export const commentStateCountsOf = ({ entries }: EntriesParams): CommentStateCounts => {
  const resolved = entries.filter((entry) => isSettledWord({ word: entry.resolveWord })).length;
  const counts = reviewCounts({ threads: entries.map((entry) => entry.row.thread) });
  return { open: entries.length - resolved, resolved, needYou: counts.needYou };
};

export const groupsInViewOf = ({ groups, scope, state }: ViewParams): ReadonlyArray<ReviewGroup> =>
  groups
    .map(({ group, entries }) => ({
      group,
      entries: entries.filter((entry) => {
        const isNote = entry.row.thread.originKind === 'diff_comment';
        if ((scope === 'notes' && !isNote) || (scope === 'comments' && isNote)) {
          return false;
        }
        const isSettled = isSettledWord({ word: entry.resolveWord });
        return state === 'resolved' ? isSettled : !isSettled;
      }),
    }))
    .filter((group) => group.entries.length > 0);
