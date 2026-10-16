import { useEffect, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { isPrReviewSession } from '../../../../../store/slices/session-view';

type Params = {
  readonly sessionId: SessionId;
};

export const useReviewDraftCount = ({ sessionId }: Params): number => {
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const isPrReview = useMemo(() => isPrReviewSession({ agents: phaseRuns }), [phaseRuns]);
  const reviewDrafts = useAppStore((s) => s.reviewDrafts[sessionId]);
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);

  useEffect(() => {
    if (!isPrReview || reviewDrafts !== undefined) {
      return;
    }
    void loadReviewDrafts(sessionId);
  }, [isPrReview, reviewDrafts, loadReviewDrafts, sessionId]);

  if (!isPrReview || reviewDrafts === undefined) {
    return 0;
  }
  return reviewDrafts.filter((draft) => draft.status === 'draft').length;
};
