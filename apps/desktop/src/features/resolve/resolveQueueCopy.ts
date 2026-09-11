import type { ResolveQueueStatus } from '../../store/slices/resolve/deriveResolveQueueStatus';

export const RESOLVE_QUEUE_TITLE = 'Resolve';

export const RESOLVE_QUEUE_STATUS_LABEL: Record<ResolveQueueStatus, string> = {
  fix_ready: 'Fix ready, on your machine',
  reply_ready: 'Reply ready',
  no_change: 'No change proposed',
  agent_asked: 'Answer agent',
  working: 'Working',
  ready_to_push: 'Approved, not published',
  pushed: 'Published',
  later: 'Later',
  changed_since_accepted: 'Review again',
  delivery_failed: 'Delivery failed',
  confirm_delivery: 'Confirm delivery',
  run_failed: 'Run failed',
  run_stopped: 'Run stopped',
  wont_fix: 'Will not fix',
  wont_fix_sent: 'Will not fix, reply sent',
};

export const RESOLVE_QUEUE_NEXT_STEP: Record<ResolveQueueStatus, string | null> = {
  fix_ready: 'Nothing left your machine yet. Approve the fix, then publish it',
  reply_ready: 'The agent wrote a reply and no code change. Approve it, then publish it',
  no_change: 'No fix and no reply on this one yet. Start a run, or write the reply yourself',
  agent_asked: 'The run is parked on a question. Answer it to let the run carry on',
  working: 'A run is holding this comment. Wait for it to end',
  ready_to_push: 'Approved here, still untouched on the pull request. Publish it',
  pushed: null,
  later: 'Parked by you. Resume it when you want it back',
  changed_since_accepted: 'The reviewer changed the comment after you approved. Read it again',
  delivery_failed: 'The push or the reply did not land. Check and retry',
  confirm_delivery: 'The answer may or may not have landed. Open the pull request and confirm',
  run_failed: 'The run ended on an error. Read it, then ask the agent to revise',
  run_stopped: 'The run was stopped before it finished. Start it again',
  wont_fix: 'The reviewer has not read your refusal yet. Publish the reply',
  wont_fix_sent: null,
};

export const RESOLVE_QUEUE_ACTION_LABEL = {
  resume: 'Resume',
  later: 'Later',
  approveFix: 'Approve fix',
  answerAgent: 'Answer agent',
  wontFix: 'Will not fix',
  askForChanges: 'Ask agent to revise',
  send: 'Send to agent',
  startRun: 'Start resolve run',
  openComment: 'Open comment',
  cancel: 'Cancel',
} as const;

export const RESOLVE_QUEUE_REFRESH_LABEL = 'the latest comments';

export const RESOLVE_RUN_IN_PROGRESS = 'Resolve run in progress';

export const RESOLVE_COMMENT_UNAVAILABLE = 'Comment unavailable';

export const RESOLVE_HISTORY_LABEL = {
  later: 'later',
  completed: 'completed',
} as const;

export const RESOLVE_DELIVERY_SUPPORT = {
  replyPending: 'Reply pending',
  replyPosted: 'Reply posted',
  threadResolved: 'Thread resolved',
  threadLeftOpen: 'Thread left open',
} as const;

const countedLabel = ({
  label,
  count,
}: {
  readonly label: string;
  readonly count: number;
}): string => (count === 0 ? label : `${label} ${count}`);

export const needsReviewFilterLabel = ({ count }: { readonly count: number }): string =>
  countedLabel({ label: 'Needs review', count });

export const activeFilterLabel = ({ count }: { readonly count: number }): string =>
  countedLabel({ label: 'Active', count });

export const retryableFilterLabel = ({ count }: { readonly count: number }): string =>
  countedLabel({ label: 'Retryable', count });

export const RESOLVE_QUEUE_COUNT_LABEL = {
  queued: 'queued',
  working: 'working',
  question: 'question',
  failed: 'failed',
  published: 'published',
} as const;

export const RESOLVE_QUEUE_COUNTS_LABEL = 'Queue counts';

export const RESOLVE_QUEUE_RETRYABLE_EMPTY = 'Nothing to retry right now';

export const sharedRunHeading = ({ count }: { readonly count: number }): string =>
  `Shared run · ${count} ${count === 1 ? 'comment' : 'comments'}`;
