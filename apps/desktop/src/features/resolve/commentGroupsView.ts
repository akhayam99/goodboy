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

export type CountableEntry = {
  readonly resolveWord: ReviewEntry['resolveWord'];
  readonly row: {
    readonly thread: Pick<
      ReviewEntry['row']['thread'],
      'stage' | 'state' | 'stateReason' | 'originKind'
    >;
  };
};

export type ThreadEntry = CountableEntry & {
  readonly threadId: string;
};

type EntriesParams<T extends CountableEntry> = {
  readonly entries: ReadonlyArray<T>;
};

export const commentStateCountsOf = ({
  entries,
}: EntriesParams<CountableEntry>): CommentStateCounts => {
  const resolved = entries.filter((entry) => isSettledWord({ word: entry.resolveWord })).length;
  const counts = reviewCounts({ threads: entries.map((entry) => entry.row.thread) });
  return { open: entries.length - resolved, resolved, needYou: counts.needYou };
};

type ScopeParams<T extends CountableEntry> = EntriesParams<T> & {
  readonly scope: CommentScope;
};

type InScopeParams = {
  readonly entry: CountableEntry;
  readonly scope: CommentScope;
};

const isInScope = ({ entry, scope }: InScopeParams): boolean => {
  const isNote = entry.row.thread.originKind === 'diff_comment';
  return !((scope === 'notes' && !isNote) || (scope === 'comments' && isNote));
};

export const entriesInScopeOf = <T extends CountableEntry>({
  entries,
  scope,
}: ScopeParams<T>): ReadonlyArray<T> => entries.filter((entry) => isInScope({ entry, scope }));

export const stateCountsInScopeOf = <T extends CountableEntry>({
  entries,
  scope,
}: ScopeParams<T>): CommentStateCounts =>
  commentStateCountsOf({ entries: entriesInScopeOf({ entries, scope }) });

export const groupsInViewOf = ({ groups, scope, state }: ViewParams): ReadonlyArray<ReviewGroup> =>
  groups
    .map(({ group, entries }) => ({
      group,
      entries: entries.filter((entry) => {
        if (!isInScope({ entry, scope })) {
          return false;
        }
        const isSettled = isSettledWord({ word: entry.resolveWord });
        return state === 'resolved' ? isSettled : !isSettled;
      }),
    }))
    .filter((group) => group.entries.length > 0);
