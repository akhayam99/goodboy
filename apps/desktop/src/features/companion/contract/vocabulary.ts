export type Tone =
  'success' | 'info' | 'warning' | 'danger' | 'primary' | 'unread' | 'merged' | 'draft' | 'neutral';

export type StatusMarkState =
  | 'running'
  | 'merging'
  | 'queued'
  | 'question'
  | 'approval'
  | 'budget'
  | 'alert'
  | 'ready'
  | 'failed'
  | 'done'
  | 'merged'
  | 'approved'
  | 'closed'
  | 'stopped'
  | 'skipped';

export type StateMark = {
  readonly kind: 'state';
  readonly state: StatusMarkState;
};

export type DotMark = {
  readonly kind: 'dot';
  readonly tone: Tone;
};

export type CountMark = {
  readonly kind: 'count';
  readonly tone: Tone;
  readonly text: string;
};

export type EmptyMark = {
  readonly kind: 'empty';
};

export type StatusMark = StateMark | DotMark | CountMark | EmptyMark;

export type SessionStage = 'attention' | 'running' | 'review' | 'building' | 'done';

export type AttentionReason =
  | 'agent-error'
  | 'push-failed'
  | 'open-question'
  | 'fix-needs-you'
  | 'fix-couldnt-fix'
  | 'unread-reply'
  | 'ci-failed'
  | 'changes-requested'
  | 'pr-queued'
  | 'pr-approved'
  | 'needs-approval'
  | 'plan-approval'
  | 'run-stopped'
  | 'run-paused-at-limit'
  | 'run-waits-for-go'
  | 'auto-needs-you'
  | 'slack-reply-waiting';

export type MergeMethod = 'squash' | 'merge' | 'rebase';

export type TaskProvider = 'linear' | 'sentry' | 'gitlab' | 'jira';

export type SessionAccess = 'edits';
