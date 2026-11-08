import type { PrDetail } from '@goodboy/types';
import {
  stateCountsInScopeOf,
  type CommentStateCounts,
  type ThreadEntry,
} from '../resolve/commentGroupsView';
import { hostThreadCountsOf } from './components/PullRequestTab/hostThreadCountsOf';

type Params = {
  readonly pr: { readonly number: number } | null;
  readonly detail: PrDetail | null;
  readonly entries: ReadonlyArray<ThreadEntry>;
  readonly isWithNotes: boolean;
};

export const pullRequestThreadCountsOf = ({
  pr,
  detail,
  entries,
  isWithNotes,
}: Params): CommentStateCounts => {
  const matched = pr !== null && detail !== null && detail.prNumber === pr.number ? detail : null;
  const host = hostThreadCountsOf({ comments: matched?.comments ?? null, entries });
  if (!isWithNotes) {
    return host;
  }
  const notes = stateCountsInScopeOf({ entries, scope: 'notes' });
  return {
    open: host.open + notes.open,
    resolved: host.resolved + notes.resolved,
    needYou: host.needYou + notes.needYou,
  };
};
