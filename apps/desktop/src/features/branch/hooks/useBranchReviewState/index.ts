import { useMemo } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import { branchPushFactsOf } from '../../../../shared/lib/branchPushState';
import type { ResolveQueueRow } from '../../../resolve/buildResolveQueueRows';
import { isPushFailure } from '../../../resolve/reviewCommentState';
import type { BranchPushState, BranchReviewCounts } from '../../branchPrimary';

type FactsParams = Parameters<typeof branchPushFactsOf>[0];

type EntryFacts = {
  readonly threadId: string;
  readonly state: string;
  readonly remote: string | null;
  readonly row: ResolveQueueRow;
};

type Params = {
  readonly entries: ReadonlyArray<EntryFacts>;
  readonly phaseKind: string;
  readonly status: WorktreeStatus | null;
  readonly commits: FactsParams['commits'];
  readonly hasRemoteHead: boolean;
};

type BranchReviewState = {
  readonly hasPushFailure: boolean;
  readonly isPushBusy: boolean;
  readonly pushCount: number;
  readonly review: BranchReviewCounts;
};

export const useBranchReviewState = ({
  entries,
  phaseKind,
  status,
  commits,
  hasRemoteHead,
}: Params): BranchReviewState => {
  const hasPushFailure = entries.some((entry) => isPushFailure({ row: entry.row }));
  const isPushBusy =
    phaseKind === 'preparing' || phaseKind === 'pushing' || phaseKind === 'syncing';
  const pushableIds = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            (entry.state === 'accepted' || entry.state === 'replied') &&
            entry.remote !== 'on_origin',
        )
        .map((entry) => entry.threadId),
    [entries],
  );
  const pushState: BranchPushState =
    phaseKind === 'confirm' || phaseKind === 'sync_confirm' ? 'open' : isPushBusy ? 'busy' : 'idle';
  const pushCount = branchPushFactsOf({ status, commits, hasRemoteHead }).toPush;
  const review = useMemo<BranchReviewCounts>(
    () => ({
      accepted: pushableIds.length,
      replies: entries.filter((entry) => entry.remote === 'on_origin').length,
      failed: entries.filter(
        (entry) => entry.state === 'failed' && isPushFailure({ row: entry.row }),
      ).length,
      isPushing: entries.some((entry) => entry.row.thread.stage === 'publishing'),
      push: { state: pushState, count: pushCount },
    }),
    [entries, pushCount, pushState, pushableIds],
  );
  return { hasPushFailure, isPushBusy, pushCount, review };
};
