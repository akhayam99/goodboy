import type { WorkNodeState } from '@goodboy/ui';
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

export type ReviewCommentGroup = 'open' | 'waiting' | 'done';

export const REVIEW_COMMENT_GROUPS: ReadonlyArray<ReviewCommentGroup> = ['open', 'waiting', 'done'];

export const REVIEW_COMMENT_GROUP_LABEL: Record<ReviewCommentGroup, string> = {
  open: 'Open',
  waiting: 'Waiting for the push',
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

const DECIDED_STATES: ReadonlySet<ReviewCommentState> = new Set(['accepted', 'replied', 'skipped']);

export const reviewCommentGroup = ({
  state,
}: {
  readonly state: ReviewCommentState;
}): ReviewCommentGroup => {
  if (OPEN_STATES.has(state)) {
    return 'open';
  }
  return DECIDED_STATES.has(state) ? 'waiting' : 'done';
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
      return 'Drafting';
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
      return 'Resolved on GitHub';
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

export const REVIEW_COMMENT_NODE: Record<ReviewCommentState, WorkNodeState> = {
  new: 'queued',
  drafting: 'running',
  needs: 'question',
  ready: 'ready',
  edited: 'ready',
  outdated: 'stopped',
  failed: 'failed',
  accepted: 'done',
  replied: 'done',
  skipped: 'skipped',
  pushed: 'done',
  resolved: 'closed',
};

export const REVIEW_COUNT_NOUN: Record<ReviewCommentState, string> = {
  new: 'not started',
  drafting: 'drafting',
  needs: 'need you',
  ready: 'ready',
  edited: 'ready',
  outdated: 'changed',
  failed: 'failed',
  accepted: 'accepted',
  replied: 'reply only',
  skipped: 'skipped',
  pushed: 'pushed',
  resolved: 'resolved',
};
