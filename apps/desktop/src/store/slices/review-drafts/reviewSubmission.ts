import type { SessionId } from '@goodboy/types';
import type { GetFn, PublishPrReviewResult, PublishPrReviewVerdict, SetFn } from './types';

export type ReviewSubmission = {
  readonly verdict: PublishPrReviewVerdict;
  readonly summary: string;
  readonly isSubmitting: boolean;
};

export const EMPTY_REVIEW_SUBMISSION: ReviewSubmission = {
  verdict: 'comment',
  summary: '',
  isSubmitting: false,
};

type PatchParams = {
  readonly sessionId: SessionId;
  readonly patch: Partial<ReviewSubmission>;
};

const patchSubmission = (set: SetFn, { sessionId, patch }: PatchParams): void =>
  set((state) => ({
    reviewSubmission: {
      ...state.reviewSubmission,
      [sessionId]: {
        ...(state.reviewSubmission[sessionId] ?? EMPTY_REVIEW_SUBMISSION),
        ...patch,
      },
    },
  }));

export const setReviewSubmission =
  (set: SetFn) =>
  (params: PatchParams): void =>
    patchSubmission(set, params);

type SessionParams = {
  readonly sessionId: SessionId;
};

export const submitReview =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId }: SessionParams): Promise<PublishPrReviewResult> => {
    const current = get().reviewSubmission[sessionId] ?? EMPTY_REVIEW_SUBMISSION;
    patchSubmission(set, { sessionId, patch: { isSubmitting: true } });
    try {
      const result = await get().publishPrReview(sessionId, {
        verdict: current.verdict,
        body: current.summary.trim(),
      });
      await get().loadReviewDrafts(sessionId);
      if (result.failed.length === 0) {
        patchSubmission(set, { sessionId, patch: EMPTY_REVIEW_SUBMISSION });
      }
      return result;
    } finally {
      patchSubmission(set, { sessionId, patch: { isSubmitting: false } });
    }
  };

export const discardReview =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId }: SessionParams): Promise<void> => {
    const open = (get().reviewDrafts[sessionId] ?? []).filter((draft) => draft.status === 'draft');
    for (const draft of open) {
      await get().discardReviewDraft(draft.id);
    }
    patchSubmission(set, { sessionId, patch: EMPTY_REVIEW_SUBMISSION });
  };
