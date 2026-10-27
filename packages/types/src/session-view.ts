import type { PullRequestStateKind } from './github';

export type SessionSortKey = 'needsYou' | 'updatedAt' | 'goal' | 'createdAt';

export type SessionGroupKey = 'none' | 'pr' | 'stage' | 'project';

export type SessionPageView = 'board' | 'list';

export type SessionViewPrefs = Readonly<{
  pageView: SessionPageView;
  sort: SessionSortKey;
  group: SessionGroupKey;
  isArchivedShown: boolean;
  isFoldOpen: boolean;
  statusFilter: ReadonlyArray<SessionStage>;
}>;

export type PersistedSessionViewPrefs = SessionViewPrefs & Readonly<{ v: 3 }>;

export type SessionStage = 'attention' | 'running' | 'review' | 'building' | 'done';

export type SessionAttentionReason =
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

export type SessionPrFetchState = 'unknown' | 'unreachable' | 'known';

export type SessionStageInfo = Readonly<{
  stage: SessionStage;
  reason: string;
  addsFact: boolean;
  attention: SessionAttentionReason | null;
  attentionSince?: number | null;
  prState: PullRequestStateKind | null;
  isRunning?: boolean;
  otherReasons?: ReadonlyArray<SessionAttentionReason>;
  openQuestionCount?: number;
  fixNeedsYouCount?: number;
  fixCouldntFixCount?: number;
  pushFailedCount?: number;
  noteNeedsYouCount?: number;
  noteCouldntFixCount?: number;
}>;

export type SessionPrGroup =
  'not-open' | 'draft' | 'reviewable' | 'reviewed' | 'queued' | 'closed' | 'merged';
