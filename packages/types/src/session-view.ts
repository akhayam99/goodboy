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

export type SessionStageInfo = Readonly<{
  stage: SessionStage;
  reason: string;
}>;

export type SessionPrGroup =
  | 'not-open'
  | 'draft'
  | 'reviewable'
  | 'reviewed'
  | 'queued'
  | 'closed'
  | 'merged';
