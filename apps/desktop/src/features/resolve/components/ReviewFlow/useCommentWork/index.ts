import { useCallback, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { commentWorkOf, type CommentWork } from '../../../commentWorkOf';
import type { FixRun } from '../../../fixRun';
import type { LaneStatus } from '../../../laneStatus';
import type { StopWorkParams } from '../CommentWorkLine';
import type { ReviewEntry } from '../useReviewEntries';

type Params = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly run: FixRun | null;
  readonly lane: LaneStatus | null;
};

type CommentWorkView = {
  readonly works: ReadonlyMap<string, CommentWork>;
  readonly stopWork: (params: StopWorkParams) => void;
};

export const useCommentWork = ({ sessionId, entries, run, lane }: Params): CommentWorkView => {
  const forceCloseResolver = useAppStore((s) => s.forceCloseResolver);
  const stopResolveLane = useAppStore((s) => s.stopResolveLane);
  const works = useMemo(
    () =>
      commentWorkOf({
        entries,
        runThreadIds: run?.threadIds ?? [],
        runAgentId: run?.agentId ?? null,
      }),
    [entries, run],
  );
  const stopWork = useCallback(
    ({ agentId }: StopWorkParams): void =>
      void (lane === null
        ? forceCloseResolver(sessionId, agentId)
        : stopResolveLane({ sessionId, worktreePath: lane.worktreePath })),
    [forceCloseResolver, lane, sessionId, stopResolveLane],
  );
  return { works, stopWork };
};
