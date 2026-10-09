import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { fixRunTranscript } from '../../../../store/slices/navigation/place';
import { activeReviewSourceOf } from '../../../../store/slices/review-source/activeReviewSource';
import { useQuietFollowToast } from '../../../../shared/hooks/useFollowToast';
import { markUserStart } from '../../../../shared/lib/userStarts';
import {
  fixStartKeyOf,
  fixStartedMessageOf,
  fixStartedTitleOf,
  fixStartedWhereOf,
} from '../../fixStartedToast';
import type { StartedBatch } from '../../startBatch';

type Params = {
  readonly sessionId: SessionId;
  readonly started: StartedBatch;
  readonly count: number;
  readonly noun?: 'comment' | 'note';
};

export const useFixStartedToast = (): ((params: Params) => void) => {
  const follow = useQuietFollowToast();
  return useCallback(
    ({ sessionId, started, count, noun = 'comment' }: Params): void => {
      const state = useAppStore.getState();
      const attempt =
        (state.sessionResolveAttempts[sessionId] ?? []).find(
          (candidate) => candidate.agentId === started.agentId,
        ) ?? null;
      const source = activeReviewSourceOf({ state, sessionId });
      const transcript = fixRunTranscript({ sessionId, agentId: started.agentId });
      markUserStart({ key: started.agentId });
      follow({
        title: fixStartedTitleOf({ isQueued: attempt?.phase === 'queued' }),
        message: fixStartedMessageOf({
          count,
          noun,
          where: fixStartedWhereOf({
            repo: source?.repo ?? null,
            prNumber: source?.prNumber ?? null,
          }),
        }),
        target: { place: transcript.to, drawer: transcript.drawer },
        startKey: fixStartKeyOf({ batchId: started.batchId }),
      });
    },
    [follow],
  );
};
