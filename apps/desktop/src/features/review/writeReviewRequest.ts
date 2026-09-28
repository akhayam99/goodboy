import type { SessionId } from '@goodboy/types';

export const WRITE_REVIEW_EDIT_EVENT = 'goodboy:write-review-edit';

export type WriteReviewEditRequest = {
  readonly sessionId: SessionId;
  readonly draftId: string;
};

export const requestDraftEdit = (detail: WriteReviewEditRequest): void => {
  window.dispatchEvent(
    new CustomEvent<WriteReviewEditRequest>(WRITE_REVIEW_EDIT_EVENT, { detail }),
  );
};

export const isDraftEditRequest = (event: Event): event is CustomEvent<WriteReviewEditRequest> =>
  event instanceof CustomEvent &&
  typeof event.detail === 'object' &&
  event.detail !== null &&
  'draftId' in event.detail;
