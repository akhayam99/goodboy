import type { MountId, SessionId } from '@goodboy/types';
import { isDraftOnTarget, type ReviewTarget } from './resolveReviewTarget';
import type { GetFn, PublishPrReviewResult, PublishPrReviewVerdict, SetFn } from './types';

export type ReviewSubmission = {
  readonly verdict: PublishPrReviewVerdict;
  readonly summary: string;
  readonly isSubmitting: boolean;
  readonly chosenTarget: ReviewTarget | null;
};

export const EMPTY_REVIEW_SUBMISSION: ReviewSubmission = {
  verdict: 'comment',
  summary: '',
  isSubmitting: false,
  chosenTarget: null,
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

type SubmitParams = {
  readonly sessionId: SessionId;
  readonly target: ReviewTarget;
  readonly mountId: MountId | null;
};

export const submitReview =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId, target, mountId }: SubmitParams): Promise<PublishPrReviewResult> => {
    const current = get().reviewSubmission[sessionId] ?? EMPTY_REVIEW_SUBMISSION;
    patchSubmission(set, { sessionId, patch: { isSubmitting: true } });
    try {
      const result = await get().publishPrReview(sessionId, {
        verdict: current.verdict,
        body: current.summary.trim(),
        target,
        mountId,
      });
      await get().loadReviewDrafts(sessionId);
      if (result.failed.length === 0) {
        patchSubmission(set, {
          sessionId,
          patch: { verdict: EMPTY_REVIEW_SUBMISSION.verdict, summary: '' },
        });
      }
      return result;
    } finally {
      patchSubmission(set, { sessionId, patch: { isSubmitting: false } });
    }
  };

type DiscardParams = {
  readonly sessionId: SessionId;
  readonly target: ReviewTarget;
};

export const discardReview =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId, target }: DiscardParams): Promise<void> => {
    const open = (get().reviewDrafts[sessionId] ?? []).filter(
      (draft) => draft.status === 'draft' && isDraftOnTarget({ draft, target }),
    );
    for (const draft of open) {
      await get().discardReviewDraft(draft.id);
    }
    patchSubmission(set, {
      sessionId,
      patch: { verdict: EMPTY_REVIEW_SUBMISSION.verdict, summary: '' },
    });
  };
