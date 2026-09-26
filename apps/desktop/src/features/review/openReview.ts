import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { ReviewDestination, ReviewTargetOutcome } from '../../store/slices/review-navigation';

type Params = {
  readonly sessionId: SessionId;
  readonly destination?: ReviewDestination;
};

export const openReview = ({ sessionId, destination }: Params): Promise<ReviewTargetOutcome> =>
  useAppStore.getState().openReviewTarget({
    sessionId,
    ...(destination !== undefined && { destination }),
  });
