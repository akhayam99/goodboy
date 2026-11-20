import { Pencil, Send, Trash2, X } from '@goodboy/ui/icons';
import type { MountId, PrReviewDraft, SessionId } from '@goodboy/types';
import { selectDisplayedMount } from '../../../store/slices/project-mounts/selectors';
import {
  internReviewTarget,
  isDraftOnTarget,
  type ReviewTarget,
} from '../../../store/slices/review-drafts/resolveReviewTarget';
import { EMPTY_REVIEW_SUBMISSION } from '../../../store/slices/review-drafts/reviewSubmission';
import { mountReviewOf } from '../../review/mountReviewOf';
import type { PublishPrReviewVerdict } from '../../../store/slices/review-drafts/types';
import { requestDraftEdit } from '../../review/writeReviewRequest';
import type { ObjectKindDefinition, WriteReviewActionTarget } from '../types';

export type WriteReviewFacts = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly reviewTarget: ReviewTarget | null;
  readonly draftId: string | null;
  readonly drafts: number;
  readonly verdict: PublishPrReviewVerdict;
  readonly hasSummary: boolean;
  readonly isSubmitting: boolean;
};

const SUBMITTING_REASON = 'Submitting now.';
const EMPTY_REVIEW_REASON = 'Add a line comment or a summary first.';

const SUBMIT_LABEL: Record<PublishPrReviewVerdict, string> = {
  comment: 'Submit comments',
  approve: 'Approve',
  request_changes: 'Request changes',
};

const EMPTY_DRAFTS: ReadonlyArray<PrReviewDraft> = [];

const popToPullRequest = ({
  facts,
  setPullRequestMode,
}: {
  readonly facts: WriteReviewFacts;
  readonly setPullRequestMode: (params: {
    readonly sessionId: SessionId;
    readonly mode: 'overview';
  }) => void;
}): void => setPullRequestMode({ sessionId: facts.sessionId, mode: 'overview' });

export const WRITE_REVIEW_KIND: ObjectKindDefinition<WriteReviewActionTarget, WriteReviewFacts> = {
  noun: 'review',
  facts: ({ state, target }) => {
    const mountId = selectDisplayedMount({ state, sessionId: target.sessionId })?.mountId ?? null;
    const reviewTarget = mountReviewOf({ state, sessionId: target.sessionId, mountId }).target;
    const drafts = (state.reviewDrafts[target.sessionId] ?? EMPTY_DRAFTS).filter(
      (draft) =>
        draft.status === 'draft' &&
        reviewTarget !== null &&
        isDraftOnTarget({ draft, target: reviewTarget }),
    );
    const submission = state.reviewSubmission[target.sessionId] ?? EMPTY_REVIEW_SUBMISSION;
    return {
      sessionId: target.sessionId,
      mountId,
      reviewTarget,
      draftId:
        target.draftId !== null && drafts.some((draft) => draft.id === target.draftId)
          ? target.draftId
          : null,
      drafts: drafts.length,
      verdict: submission.verdict,
      hasSummary: submission.summary.trim() !== '',
      isSubmitting: submission.isSubmitting,
    };
  },
  actions: [
    {
      id: 'writeReview.submit',
      label: ({ facts }) => SUBMIT_LABEL[facts.verdict],
      icon: Send,
      group: 'act',
      shortcut: 'composer.submit',
      when: ({ facts }) => facts.reviewTarget !== null,
      blockedReason: ({ facts }) => {
        if (facts.isSubmitting) {
          return SUBMITTING_REASON;
        }
        return facts.drafts === 0 && !facts.hasSummary && facts.verdict === 'comment'
          ? EMPTY_REVIEW_REASON
          : null;
      },
      slot: () => 'primary',
      run: async ({ facts, env }) => {
        const { reviewTarget } = facts;
        if (reviewTarget === null) {
          return;
        }
        const state = env.getState();
        const result = await state.submitReview({
          sessionId: facts.sessionId,
          target: reviewTarget,
          mountId: facts.mountId,
        });
        if (result.failed.length > 0) {
          throw new Error(result.failed.map((failure) => failure.error).join('\n'));
        }
        popToPullRequest({ facts, setPullRequestMode: state.setPullRequestMode });
      },
    },
    {
      id: 'writeReview.editDraft',
      label: 'Edit comment',
      icon: Pencil,
      group: 'act',
      when: ({ facts }) => facts.drafts > 0 && facts.draftId !== null,
      slot: () => 'hover',
      run: ({ facts }) => {
        if (facts.draftId !== null) {
          requestDraftEdit({ sessionId: facts.sessionId, draftId: facts.draftId });
        }
      },
    },
    {
      id: 'writeReview.deleteDraft',
      label: 'Delete comment',
      icon: Trash2,
      group: 'danger',
      isUndoable: true,
      when: ({ facts }) => facts.drafts > 0 && facts.draftId !== null,
      slot: () => 'hover',
      run: async ({ facts, env }) => {
        const state = env.getState();
        const draft = (state.reviewDrafts[facts.sessionId] ?? EMPTY_DRAFTS).find(
          (candidate) => candidate.id === facts.draftId,
        );
        if (draft === undefined) {
          return;
        }
        await state.discardReviewDraft(draft.id);
        env.getState().undoable({
          showToast: env.showToast,
          message: `Deleted the comment on ${draft.path}:${draft.line}`,
          undo: async () => {
            await env.getState().addReviewDraft({
              sessionId: facts.sessionId,
              target: internReviewTarget(draft),
              path: draft.path,
              line: draft.line,
              startLine: draft.startLine,
              side: draft.side,
              body: draft.body,
            });
          },
        });
      },
    },
    {
      id: 'writeReview.discard',
      label: 'Discard review',
      icon: X,
      group: 'danger',
      when: ({ facts }) => facts.reviewTarget !== null && (facts.drafts > 0 || facts.hasSummary),
      confirm: ({ facts }) => ({
        title: 'Discard this review?',
        description: `${
          facts.drafts === 0
            ? 'The summary goes'
            : `Your ${facts.drafts === 1 ? 'line comment' : `${facts.drafts} line comments`}${facts.hasSummary ? ' and the summary go' : ' go'}`
        }. Nothing was sent.`,
        confirmLabel: 'Discard',
        role: 'danger',
      }),
      slot: () => 'menu',
      run: async ({ facts, env }) => {
        const { reviewTarget } = facts;
        if (reviewTarget === null) {
          return;
        }
        const state = env.getState();
        await state.discardReview({ sessionId: facts.sessionId, target: reviewTarget });
        popToPullRequest({ facts, setPullRequestMode: state.setPullRequestMode });
      },
    },
  ],
};
