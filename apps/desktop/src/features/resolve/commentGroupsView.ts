import { isSettledWord } from './commentStates';
import type { ReviewGroup } from './components/ReviewFlow/useReviewEntries';
import type { CommentScope, CommentState } from './components/ReviewFlow/ReviewScopeBar';

type GroupsParams = {
  readonly groups: ReadonlyArray<ReviewGroup>;
};

type ViewParams = GroupsParams & {
  readonly scope: CommentScope;
  readonly state: CommentState;
};

export const settledCountOf = ({ groups }: GroupsParams): number =>
  groups
    .flatMap((group) => group.entries)
    .filter((entry) => isSettledWord({ word: entry.resolveWord })).length;

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
