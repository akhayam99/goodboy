import { reviewLaunchInitialState } from './state';
import type {
  ConsumeReviewLaunchParams,
  RequestReviewLaunchParams,
  ReviewLaunchSlice,
} from './types';
import type { SliceDeps } from '../../slice-types';

export const createReviewLaunchSlice = ({ set }: SliceDeps): ReviewLaunchSlice => ({
  ...reviewLaunchInitialState,
  requestReviewLaunch: ({ sessionId, threadIds }: RequestReviewLaunchParams) =>
    set((state) => ({
      reviewLaunchRequests: {
        ...state.reviewLaunchRequests,
        [sessionId]: { requestId: crypto.randomUUID(), threadIds: [...new Set(threadIds)] },
      },
    })),
  consumeReviewLaunch: ({ sessionId, requestId }: ConsumeReviewLaunchParams) =>
    set((state) => {
      if (state.reviewLaunchRequests[sessionId]?.requestId !== requestId) {
        return state;
      }
      return { reviewLaunchRequests: { ...state.reviewLaunchRequests, [sessionId]: null } };
    }),
});
