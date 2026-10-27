import type { PrReviewDraft, SessionId } from '@goodboy/types';
import type { ReviewSubmission } from './reviewSubmission';

export type ReviewDraftsState = {
  readonly reviewDrafts: Readonly<Record<SessionId, ReadonlyArray<PrReviewDraft>>>;
  readonly reviewSubmission: Readonly<Record<SessionId, ReviewSubmission>>;
};

export const reviewDraftsInitialState: ReviewDraftsState = {
  reviewDrafts: {},
  reviewSubmission: {},
};
