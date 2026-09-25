import type { ResolveQueueFilter } from '../../store/slices/session-view';
import type { ResolveUiState } from './resolveRowState';

export const RESOLVE_QUEUE_TITLE = 'Conversations';

export const RESOLVE_QUEUE_NEXT_STEP: Record<ResolveUiState, string | null> = {
  new: 'Nobody has worked on this comment yet. Resolve it to send an agent',
  working: 'An agent is working on this comment',
  needs_you: 'Your answer starts a new attempt for this comment.',
  ready: 'The proposal is still on your machine. Review it, then approve it',
  approved: 'Approved here, not on GitHub yet. Close it on GitHub to publish',
  resolved: null,
  failed: 'Something did not land. Retry the step that failed',
  later: 'Parked by you. Resume it when you want it back',
};

export const RESOLVE_QUEUE_ACTION_LABEL = {
  resume: 'Resume',
  later: 'Later',
  approveFix: 'Resolve',
  approveReply: 'Resolve',
  answerAgent: 'Answer agent',
  wontFix: 'Will not fix',
  askForChanges: 'Ask agent to revise',
  send: 'Send to agent',
  openComment: 'Open comment',
  cancel: 'Cancel',
  clearSelection: 'Clear',
  resolveOptions: 'Choose the model',
  note: 'Note for the agent (optional)',
} as const;

type CountParams = { readonly count: number };

const commentNoun = ({ count }: CountParams): string => (count === 1 ? 'comment' : 'comments');

export const resolveNewLabel = ({ count }: CountParams): string => `Resolve ${count} new`;

export const resolveCountLabel = ({ count }: CountParams): string => `Resolve ${count}`;

export const resolvePopoverHeading = ({ count }: CountParams): string =>
  `Resolve ${count} ${commentNoun({ count })}`;

export const resolveSelectionLabel = ({ count }: CountParams): string => `${count} selected`;

export const resolveSelectLabel = ({ body }: { readonly body: string }): string => `Select ${body}`;

export const resolveAgentsLine = ({
  agents,
  count,
}: CountParams & { readonly agents: number }): string => {
  const noun = commentNoun({ count });
  if (agents <= 1) {
    return count === 1
      ? 'One agent works on this comment'
      : `One agent works on these ${count} ${noun}`;
  }
  return `${agents} agents, ${count} ${noun}`;
};

export const resolveWithLabel = ({ summary }: { readonly summary: string }): string =>
  `With ${summary}`;

export const RESOLVE_QUEUE_REFRESH_LABEL = 'comments from GitHub';

export const RESOLVE_RUN_IN_PROGRESS = 'Resolve run in progress';

export const RESOLVE_COMMENT_UNAVAILABLE = 'Comment unavailable';

export const RESOLVE_HISTORY_LABEL = {
  later: 'later',
  completed: 'completed',
} as const;

export const RESOLVE_PUBLISH_REPLIES_LABEL = 'replies';

export const RESOLVE_DELIVERY_SUPPORT = {
  replyPending: 'Reply pending',
  replyPosted: 'Reply posted',
  threadResolved: 'Resolved on GitHub',
  threadLeftOpen: 'Left open on GitHub',
} as const;

export const RESOLVE_REPLY_PLAN = {
  resolves: 'Resolves the thread on GitHub',
  leavesOpen: 'Leaves the thread open on GitHub',
} as const;

export const RESOLVE_QUEUE_FILTER_LABEL: Record<ResolveQueueFilter, string> = {
  needs_review: 'Needs review',
  everything: 'Active',
  retryable: 'Retryable',
};

export const RESOLVE_QUEUE_RETRYABLE_EMPTY = 'Nothing to retry right now';

export const sharedRunHeading = ({ count }: { readonly count: number }): string =>
  `Shared run · ${count} ${count === 1 ? 'comment' : 'comments'}`;
