import { acceptReviewComments } from './acceptReviewComments';
import { reviewBulkInitialState } from './state';
import type { AcceptReviewCommentsParams, ReviewBulkSlice, UndoReviewAcceptsParams } from './types';
import type { SliceDeps } from '../../slice-types';

export const createReviewBulkSlice = ({ set, get }: SliceDeps): ReviewBulkSlice => ({
  ...reviewBulkInitialState,
  acceptReviewComments: (params: AcceptReviewCommentsParams) =>
    acceptReviewComments({ set, get, ...params }),
  undoReviewAccepts: async ({ sessionId }: UndoReviewAcceptsParams) => {
    const last = get().reviewBulkAccepts[sessionId] ?? null;
    if (last === null) {
      return false;
    }
    const isUndone = await get().undoLastOperation({
      id: last.operationId,
      shouldAnnounce: false,
    });
    set((state) => ({ reviewBulkAccepts: { ...state.reviewBulkAccepts, [sessionId]: null } }));
    return isUndone;
  },
});
