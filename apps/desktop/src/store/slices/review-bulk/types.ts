import type { SessionId } from '@goodboy/types';
import type { ReviewBulkState } from './state';

export type AcceptReviewCommentsParams = {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

export type UndoReviewAcceptsParams = {
  readonly sessionId: SessionId;
};

export type ReviewBulkFailure = {
  readonly threadId: string;
  readonly message: string;
};

export type ReviewBulkAcceptResult = {
  readonly acceptedCount: number;
  readonly failures: ReadonlyArray<ReviewBulkFailure>;
};

export type ReviewBulkSlice = ReviewBulkState & {
  acceptReviewComments(params: AcceptReviewCommentsParams): Promise<ReviewBulkAcceptResult>;
  undoReviewAccepts(params: UndoReviewAcceptsParams): Promise<boolean>;
};
