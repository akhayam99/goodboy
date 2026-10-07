import type { PullRequestStateKind } from './github';

export type SessionSortKey = 'needsYou' | 'updatedAt' | 'goal' | 'createdAt';

export type SessionGroupKey = 'none' | 'pr' | 'stage' | 'project';

export type SessionViewPrefs = Readonly<{
  sort: SessionSortKey;
  group: SessionGroupKey;
  isArchivedShown: boolean;
  isFoldOpen: boolean;
}>;

export type PersistedSessionViewPrefs = SessionViewPrefs & Readonly<{ v: 2 }>;

export type SessionStage = 'attention' | 'running' | 'review' | 'building' | 'done';

export type SessionAttentionReason =
  | 'agent-error'
  | 'open-question'
  | 'fix-needs-you'
  | 'fix-couldnt-fix'
  | 'unread-reply'
  | 'ci-failed'
  | 'changes-requested'
  | 'pr-queued'
  | 'pr-approved'
  | 'needs-approval'
  | 'plan-approval';

export type SessionPrFetchState = 'unknown' | 'unreachable' | 'known';

export type SessionStageInfo = Readonly<{
  stage: SessionStage;
  reason: string;
  addsFact: boolean;
  attention: SessionAttentionReason | null;
  prState: PullRequestStateKind | null;
  isRunning?: boolean;
  otherReasons?: ReadonlyArray<SessionAttentionReason>;
  openQuestionCount?: number;
  fixNeedsYouCount?: number;
  fixCouldntFixCount?: number;
}>;

export type SessionPrGroup =
  'not-open' | 'draft' | 'reviewable' | 'reviewed' | 'queued' | 'closed' | 'merged';
