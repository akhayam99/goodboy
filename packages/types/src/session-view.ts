import type { PullRequestStateKind } from './github';

export type SessionSortKey = 'updatedAt' | 'goal' | 'createdAt';

export type SessionGroupKey = 'none' | 'stage' | 'pr';

export type SessionViewPrefs = Readonly<{
  sort: SessionSortKey;
  group: SessionGroupKey;
}>;

export type PersistedSessionViewPrefs = Readonly<{
  v: 1;
  sort: SessionSortKey;
  group: SessionGroupKey;
}>;

export type SessionStage = 'attention' | 'running' | 'review' | 'building' | 'done';

export type SessionAttentionReason =
  | 'agent-error'
  | 'open-question'
  | 'fix-needs-you'
  | 'fix-couldnt-fix'
  | 'unread-reply'
  | 'ci-failed'
  | 'changes-requested'
  | 'pr-approved'
  | 'needs-approval';

export type SessionPrFetchState = 'unknown' | 'unreachable' | 'known';

export type SessionStageInfo = Readonly<{
  stage: SessionStage;
  reason: string;
  addsFact: boolean;
  attention: SessionAttentionReason | null;
  prState: PullRequestStateKind | null;
}>;

export type SessionPrGroup =
  'not-open' | 'draft' | 'reviewable' | 'reviewed' | 'queued' | 'closed' | 'merged';
