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
  | 'unread-reply'
  | 'ci-failed'
  | 'changes-requested'
  | 'pr-approved';

export type SessionStageInfo = Readonly<{
  stage: SessionStage;
  reason: string;
  attention?: SessionAttentionReason;
}>;

export type SessionPrGroup =
  | 'not-open'
  | 'draft'
  | 'reviewable'
  | 'reviewed'
  | 'queued'
  | 'closed'
  | 'merged';
