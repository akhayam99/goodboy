import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { ReviewTargetOutcome } from '../../store/slices/review-navigation';
import type { ReviewMode } from './reviewMode';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId;
  readonly prNumber?: number;
  readonly threadId?: string;
  readonly mode?: ReviewMode;
};

export const openReview = ({
  sessionId,
  mountId,
  prNumber,
  threadId,
  mode,
}: Params): Promise<ReviewTargetOutcome> =>
  useAppStore.getState().openReviewTarget({
    sessionId,
    ...(mountId !== undefined && { mountId }),
    ...(prNumber !== undefined && { prNumber }),
    ...(threadId !== undefined && { threadId }),
    ...(mode !== undefined && { mode }),
  });
