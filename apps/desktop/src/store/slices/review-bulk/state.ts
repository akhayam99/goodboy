import type { SessionId } from '@goodboy/types';

type ReviewBulkAccept = {
  readonly operationId: string;
  readonly itemIds: ReadonlyArray<string>;
};

export type ReviewBulkState = {
  readonly reviewBulkAccepts: Readonly<Record<SessionId, ReviewBulkAccept | null>>;
};

export const reviewBulkInitialState: ReviewBulkState = {
  reviewBulkAccepts: {},
};
