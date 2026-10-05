import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { Tone, WorkNodeState } from '@goodboy/ui';
import type { ResolveQueueRow } from './buildResolveQueueRows';

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

export type ReviewCommentGroup = 'open' | 'push' | 'done';

export const REVIEW_COMMENT_GROUPS: ReadonlyArray<ReviewCommentGroup> = ['open', 'push', 'done'];

export const REVIEW_COMMENT_GROUP_LABEL: Record<ReviewCommentGroup, string> = {
  open: 'Open',
  push: 'Ready to push',
  done: 'Done',
};

const OPEN_STATES: ReadonlySet<ReviewCommentState> = new Set([
  'new',
  'drafting',
  'needs',
  'ready',
  'edited',
  'outdated',
  'failed',
]);

const PUSH_STATES: ReadonlySet<ReviewCommentState> = new Set(['accepted', 'replied']);

export const reviewCommentGroup = ({
  state,
}: {
  readonly state: ReviewCommentState;
}): ReviewCommentGroup => {
  if (OPEN_STATES.has(state)) {
    return 'open';
  }
  return PUSH_STATES.has(state) ? 'push' : 'done';
};

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

export const isPushFailure = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.thread.stage === 'failed' && row.rowState.failedStep !== 'run';

const isWaitingForSlot = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.thread.stage === 'working' && row.attempt?.phase === 'queued' && row.attempt.batchId !== null;

export const isResolveOnly = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  (row.thread.replyDraft ?? '').trim() === '' && row.proposalKind !== 'fix';

export const reviewCommentWord = ({
  state,
  row,
}: {
  readonly state: ReviewCommentState;
  readonly row: ResolveQueueRow;
}): string => {
  if (row.thread.stage === 'publishing') {
    return 'Pushing';
  }
  switch (state) {
    case 'new':
      return 'Not started';
    case 'drafting':
      return isWaitingForSlot({ row }) ? 'Waiting' : 'Drafting';
    case 'needs':
      return 'Needs you';
    case 'ready':
    case 'edited':
      return 'Ready';
    case 'outdated':
      return 'Comment changed';
    case 'failed':
      return isPushFailure({ row }) ? 'Push failed' : 'Draft failed';
    case 'accepted':
      return 'Accepted';
    case 'replied':
      return 'Reply only';
    case 'skipped':
      return 'Skipped';
    case 'pushed':
      return 'Pushed';
    case 'resolved':
      return `Resolved on ${REVIEW_SOURCE_LABEL[row.thread.sourceKind ?? 'github']}`;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

export const resolverBriefWord = ({
  state,
  row,
}: {
  readonly state: ReviewCommentState;
  readonly row: ResolveQueueRow;
}): string => {
  switch (state) {
    case 'needs':
      return 'Needs your reply';
    case 'accepted':
    case 'replied':
      return 'Ready to push';
    default:
      return reviewCommentWord({ state, row });
  }
};

export const REVIEW_COMMENT_NODE: Record<
  ReviewCommentState,
  Exclude<WorkNodeState, 'marker' | 'mixed'>
> = {
  new: 'queued',
  drafting: 'running',
  needs: 'question',
  ready: 'stopped',
  edited: 'stopped',
  outdated: 'stopped',
  failed: 'failed',
  accepted: 'done',
  replied: 'done',
  skipped: 'skipped',
  pushed: 'done',
  resolved: 'closed',
};

export const REVIEW_COMMENT_TONE: Record<ReviewCommentState, Tone> = {
  new: 'neutral',
  drafting: 'info',
  needs: 'warning',
  ready: 'warning',
  edited: 'warning',
  outdated: 'warning',
  failed: 'danger',
  accepted: 'success',
  replied: 'success',
  skipped: 'neutral',
  pushed: 'success',
  resolved: 'neutral',
};
