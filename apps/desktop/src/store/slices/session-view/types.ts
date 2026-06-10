import type {
  Session,
  SessionGroupKey,
  SessionPrGroup,
  SessionSortKey,
  SessionStage,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export const DEFAULT_PREFS: SessionViewPrefs = { sort: 'updatedAt', group: 'stage' };

export const VALID_SORTS = new Set<SessionSortKey>(['updatedAt', 'goal', 'createdAt']);
export const VALID_GROUPS = new Set<SessionGroupKey>(['none', 'stage', 'pr']);

export const STAGE_ORDER: Record<SessionStage, number> = {
  attention: 0,
  running: 1,
  review: 2,
  building: 3,
  done: 4,
};

export const PR_GROUP_ORDER: Record<SessionPrGroup, number> = {
  'not-open': 0,
  draft: 1,
  reviewable: 2,
  reviewed: 3,
  closed: 4,
  merged: 5,
};

type SessionViewSliceState = {
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
};

type SessionViewSliceActions = {
  getSessionViewPrefs(workspaceId: WorkspaceId): SessionViewPrefs;
  setSessionSort(workspaceId: WorkspaceId, sort: SessionSortKey): void;
  setSessionGroup(workspaceId: WorkspaceId, group: SessionGroupKey): void;
};

export type SessionViewSlice = SessionViewSliceState & SessionViewSliceActions;

export type GroupedSessions = {
  readonly key: string;
  readonly sessions: ReadonlyArray<Session>;
};
