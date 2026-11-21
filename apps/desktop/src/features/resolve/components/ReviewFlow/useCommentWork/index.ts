import { useCallback, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useToast } from '../../../../../shared/components/Toast';
import { FIX_STOPPED_MESSAGE } from '../../../fixStoppedMessage';
import { stopFixWithResume } from '../../../stopFixWithResume';
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
  const { showToast } = useToast();
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
      void stopFixWithResume({
        getState: useAppStore.getState,
        showToast,
        sessionId,
        agentId,
        lane,
        message: FIX_STOPPED_MESSAGE,
      }),
    [lane, sessionId, showToast],
  );
  return { works, stopWork };
};
