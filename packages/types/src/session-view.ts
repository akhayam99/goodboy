export type SessionSortKey = 'updatedAt' | 'goal' | 'createdAt';

export type SessionGroupKey = 'none' | 'userStatus' | 'pr';

export type SessionViewPrefs = Readonly<{
  sort: SessionSortKey;
  group: SessionGroupKey;
}>;

export type PersistedSessionViewPrefs = Readonly<{
  v: 1;
  sort: SessionSortKey;
  group: SessionGroupKey;
}>;

export type SessionUserStatusGroup = 'wip' | 'waiting' | 'blocked' | 'done';

export type SessionPrGroup = 'not-open' | 'draft' | 'reviewable' | 'reviewed' | 'closed' | 'merged';
