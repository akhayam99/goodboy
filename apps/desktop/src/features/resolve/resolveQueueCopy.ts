import type { ResolveQueueStatus } from '../../store/slices/resolve/deriveResolveQueueStatus';
import type { ResolveQueueFilter } from '../../store/slices/session-view';

export const RESOLVE_QUEUE_TITLE = 'Conversations';

export const RESOLVE_QUEUE_STATUS_LABEL: Record<ResolveQueueStatus, string> = {
  fix_ready: 'Fix ready, on your machine',
  reply_ready: 'Reply ready',
  no_change: 'No change proposed',
  agent_asked: 'Question for you',
  working: 'Working',
  ready_to_push: 'Settled, not published',
  pushed: 'Published',
  later: 'Later',
  changed_since_accepted: 'Comment changed',
  delivery_failed: 'Delivery failed',
  confirm_delivery: 'Confirm delivery',
  run_failed: 'Run failed',
  run_stopped: 'Run stopped',
  wont_fix: 'Will not fix',
  wont_fix_sent: 'Will not fix, reply sent',
};

export const RESOLVE_QUEUE_NEXT_STEP: Record<ResolveQueueStatus, string | null> = {
  fix_ready: 'The fix and the reply are still on your machine. Resolve it to send both',
  reply_ready: 'The reply is still on your machine. Resolve it to send it',
  no_change: 'No fix and no reply on this one yet. Ask an agent to fix it, or reply yourself',
  agent_asked: 'Your answer starts a new attempt for this comment.',
  working: 'A run is holding this comment. Wait for it to end',
  ready_to_push: 'Settled here, still untouched on the pull request. Resolve it to publish',
  pushed: null,
  later: 'Parked by you. Resume it when you want it back',
  changed_since_accepted: 'The reviewer changed the comment after you settled it. Read it again',
  delivery_failed: 'The push or the reply did not land. Resolve it again',
  confirm_delivery: 'The answer may or may not have landed. Open the pull request and confirm',
  run_failed: 'The run ended on an error. Read it, then send the agent back in',
  run_stopped: 'The run was stopped before it finished. Start it again',
  wont_fix: 'The reviewer has not read your refusal yet. Resolve it to post the reply',
  wont_fix_sent: null,
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

export const RESOLVE_QUEUE_REFRESH_LABEL = 'the latest comments';

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
  threadResolved: 'Thread resolved',
  threadLeftOpen: 'Thread left open',
} as const;

export const RESOLVE_QUEUE_FILTER_LABEL: Record<ResolveQueueFilter, string> = {
  needs_review: 'Needs review',
  everything: 'Active',
  retryable: 'Retryable',
};

export const RESOLVE_QUEUE_RETRYABLE_EMPTY = 'Nothing to retry right now';

export const sharedRunHeading = ({ count }: { readonly count: number }): string =>
  `Shared run · ${count} ${count === 1 ? 'comment' : 'comments'}`;
