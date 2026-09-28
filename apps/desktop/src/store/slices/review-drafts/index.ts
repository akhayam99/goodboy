import { addReviewDraft } from './addReviewDraft';
import { discardReviewDraft } from './discardReviewDraft';
import { loadReviewDrafts } from './loadReviewDrafts';
import { publishPrReview } from './publishPrReview';
import { discardReview, setReviewSubmission, submitReview } from './reviewSubmission';
import { queueAgentReviewComments } from './queueAgentReviewComments';
import { updateReviewDraft } from './updateReviewDraft';
import type { GetFn, SetFn } from './types';

export const createReviewDraftsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadReviewDrafts: loadReviewDrafts(set),
    addReviewDraft: addReviewDraft(set, get),
    updateReviewDraft: updateReviewDraft(set),
    discardReviewDraft: discardReviewDraft(set),
    queueAgentReviewComments: queueAgentReviewComments(set, get),
    publishPrReview: publishPrReview(set, get),
    setReviewSubmission: setReviewSubmission(set),
    submitReview: submitReview(set, get),
    discardReview: discardReview(set, get),
  };
};

export type { AddReviewDraftInput } from './addReviewDraft';
export type { PublishPrReviewOpts, PublishPrReviewResult } from './types';
export type { ReviewSubmission } from './reviewSubmission';
