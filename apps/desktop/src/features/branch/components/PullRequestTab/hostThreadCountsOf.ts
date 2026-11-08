import type { PrComment } from '@goodboy/types';
import {
  commentStateCountsOf,
  entriesInScopeOf,
  type CommentStateCounts,
  type ThreadEntry,
} from '../../../resolve/commentGroupsView';
import { reviewHeadsOf } from './reviewHeadsOf';

type Params = {
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly entries: ReadonlyArray<ThreadEntry>;
};

export const hostThreadCountsOf = ({ comments, entries }: Params): CommentStateCounts => {
  const hostEntries = entriesInScopeOf({ entries, scope: 'comments' });
  if (hostEntries.length > 0) {
    return commentStateCountsOf({ entries: hostEntries });
  }
  const waiting = reviewHeadsOf({ comments, botKey: null }).filter(
    (head) => head.resolved !== true,
  ).length;
  return { open: waiting, resolved: 0, needYou: waiting };
};
