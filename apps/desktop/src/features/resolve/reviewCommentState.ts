import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { Tone, WorkNodeState } from '@goodboy/ui';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import {
  projectResolveComment,
  type ResolveCommentFacts,
  type ResolveCommentProjection,
} from './commentProjection';
import type { RemoteView } from './reviewRemote';

export type ReviewCommentState =
  | 'new'
  | 'drafting'
  | 'needs'
  | 'ready'
  | 'edited'
  | 'outdated'
  | 'failed'
  | 'accepted'
  | 'replied'
  | 'skipped'
  | 'pushed'
  | 'resolved';

const isReplyOnly = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.item.approvalState === 'wont_fix' || row.proposalKind !== 'fix';

export const reviewCommentStateOf = ({
  row,
  isEdited = false,
  isChanged = false,
}: {
  readonly row: ResolveQueueRow;
  readonly isEdited?: boolean;
  readonly isChanged?: boolean;
}): ReviewCommentState => {
  switch (row.thread.stage) {
    case 'new':
      return 'new';
    case 'working':
      return 'drafting';
    case 'asking':
      return 'needs';
    case 'proposed':
      if (isChanged) {
        return 'outdated';
      }
      return isEdited ? 'edited' : 'ready';
    case 'approved':
    case 'publishing':
      return isReplyOnly({ row }) ? 'replied' : 'accepted';
    case 'failed':
      return 'failed';
    case 'parked':
      return 'skipped';
    case 'resolved':
      return row.item.deliveredAt === null ? 'resolved' : 'pushed';
    default: {
      const exhaustive: never = row.thread.stage;
      return exhaustive;
    }
  }
};

const PUBLICATION_FAILED_PREFIX = 'publication_failed:';

export const isPushFailure = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.thread.stage === 'failed' &&
  (row.rowState.failedStep !== 'run' ||
    row.thread.stateReason?.startsWith(PUBLICATION_FAILED_PREFIX) === true);

const isWaitingForSlot = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.thread.stage === 'working' && row.attempt?.phase === 'queued' && row.attempt.batchId !== null;

export const isResolveOnly = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  (row.thread.replyDraft ?? '').trim() === '' && row.proposalKind !== 'fix';

type ProjectionExtras = {
  readonly gitChip?: RemoteView | null;
  readonly hasFailedChecks?: boolean;
};

const resolveFactsOfRow = ({
  state,
  row,
  gitChip = null,
  hasFailedChecks = false,
}: ProjectionExtras & {
  readonly state: ReviewCommentState;
  readonly row: ResolveQueueRow;
}): ResolveCommentFacts => ({
  state,
  isPublishing: row.thread.stage === 'publishing',
  isWaitingForSlot: isWaitingForSlot({ row }),
  isPushFailure: isPushFailure({ row }),
  sourceLabel: REVIEW_SOURCE_LABEL[row.thread.sourceKind ?? 'github'],
  attempt: row.attempt,
  gitChip,
  hasFailedChecks,
});

export const projectReviewComment = ({
  state,
  row,
  gitChip,
  hasFailedChecks,
}: ProjectionExtras & {
  readonly state: ReviewCommentState;
  readonly row: ResolveQueueRow;
}): ResolveCommentProjection =>
  projectResolveComment(resolveFactsOfRow({ state, row, gitChip, hasFailedChecks }));

export const reviewCommentWord = ({
  state,
  row,
}: {
  readonly state: ReviewCommentState;
  readonly row: ResolveQueueRow;
}): string => projectReviewComment({ state, row }).label;

export type ReviewCommentTone = ReviewCommentState | 'push_failed';

export const reviewCommentToneKeyOf = ({
  state,
  row,
}: {
  readonly state: ReviewCommentState;
  readonly row: ResolveQueueRow;
}): ReviewCommentTone => (state === 'failed' && isPushFailure({ row }) ? 'push_failed' : state);

export const REVIEW_COMMENT_NODE: Record<
  ReviewCommentTone,
  Exclude<WorkNodeState, 'marker' | 'mixed' | 'finished' | 'merging'>
> = {
  new: 'queued',
  drafting: 'running',
  needs: 'question',
  ready: 'stopped',
  edited: 'stopped',
  outdated: 'stopped',
  failed: 'alert',
  push_failed: 'failed',
  accepted: 'done',
  replied: 'done',
  skipped: 'skipped',
  pushed: 'done',
  resolved: 'closed',
};

export const REVIEW_COMMENT_TONE: Record<ReviewCommentTone, Tone> = {
  new: 'neutral',
  drafting: 'info',
  needs: 'warning',
  ready: 'warning',
  edited: 'warning',
  outdated: 'warning',
  failed: 'warning',
  push_failed: 'danger',
  accepted: 'success',
  replied: 'success',
  skipped: 'neutral',
  pushed: 'neutral',
  resolved: 'neutral',
};
