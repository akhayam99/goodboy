import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectedReviewEntryOf } from '../../../../store/slices/review-source/activeReviewSource';

type Params = {
  readonly sessionId: SessionId;
};

export const useReviewMountId = ({ sessionId }: Params): MountId | null =>
  useAppStore((state) => selectedReviewEntryOf({ state, sessionId })?.mountId ?? null);
