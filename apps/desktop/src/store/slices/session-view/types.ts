import type {
  Session,
  SessionGroupKey,
  SessionPrGroup,
  SessionSortKey,
  SessionUserStatusGroup,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store';

export type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
export type GetFn = () => AppStore;

export const DEFAULT_PREFS: SessionViewPrefs = { sort: 'updatedAt', group: 'none' };

export const VALID_SORTS = new Set<SessionSortKey>(['updatedAt', 'goal', 'createdAt']);
export const VALID_GROUPS = new Set<SessionGroupKey>(['none', 'userStatus', 'pr']);

export const USER_STATUS_ORDER: Record<SessionUserStatusGroup, number> = {
  wip: 0,
  waiting: 1,
  blocked: 2,
  done: 3,
};

export const PR_GROUP_ORDER: Record<SessionPrGroup, number> = {
  'not-open': 0,
  draft: 1,
  reviewable: 2,
  reviewed: 3,
  closed: 4,
  merged: 5,
};

export interface SessionViewSliceState {
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
}

export interface SessionViewSliceActions {
  getSessionViewPrefs(workspaceId: WorkspaceId): SessionViewPrefs;
  setSessionSort(workspaceId: WorkspaceId, sort: SessionSortKey): void;
  setSessionGroup(workspaceId: WorkspaceId, group: SessionGroupKey): void;
}

export type SessionViewSlice = SessionViewSliceState & SessionViewSliceActions;

export interface GroupedSessions {
  readonly key: string;
  readonly sessions: ReadonlyArray<Session>;
}
