import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { ReviewDestination, ReviewTargetOutcome } from '../../store/slices/review-navigation';
import type { ReviewMode } from './reviewMode';

type Params = {
  readonly sessionId: SessionId;
  readonly destination?: ReviewDestination;
  readonly mode?: ReviewMode;
};

export const openReview = ({
  sessionId,
  destination,
  mode,
}: Params): Promise<ReviewTargetOutcome> =>
  useAppStore.getState().openReviewTarget({
    sessionId,
    ...(destination !== undefined && { destination }),
    ...(mode !== undefined && { mode }),
  });
