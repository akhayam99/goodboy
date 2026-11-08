import type { PrComment } from '@goodboy/types';
import {
  stateCountsInScopeOf,
  type CommentStateCounts,
  type ThreadEntry,
} from '../../../resolve/commentGroupsView';
import { reviewHeadsOf } from './reviewHeadsOf';

type Params = {
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly entries: ReadonlyArray<ThreadEntry>;
};

export const hostThreadCountsOf = ({ comments, entries }: Params): CommentStateCounts => {
  if (entries.length > 0) {
    return stateCountsInScopeOf({ entries, scope: 'comments' });
  }
  const waiting = reviewHeadsOf({ comments, botKey: null }).filter(
    (head) => head.resolved !== true,
  ).length;
  return { open: waiting, resolved: 0, needYou: waiting };
};
