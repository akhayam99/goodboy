import type {
  PersistedSessionViewPrefs,
  Session,
  SessionGroupKey,
  SessionId,
  SessionPrGroup,
  SessionSortKey,
  SessionUserStatus,
  SessionUserStatusGroup,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore, SessionGithubState } from '../store';
import { STORAGE_PREFIXES } from '../../shared/lib/storage-keys';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

const DEFAULT_PREFS: SessionViewPrefs = { sort: 'updatedAt', group: 'none' };

const VALID_SORTS = new Set<SessionSortKey>(['updatedAt', 'goal', 'createdAt']);
const VALID_GROUPS = new Set<SessionGroupKey>(['none', 'userStatus', 'pr']);

const USER_STATUS_ORDER: Record<SessionUserStatusGroup, number> = {
  wip: 0,
  waiting: 1,
  blocked: 2,
  done: 3,
};

const PR_GROUP_ORDER: Record<SessionPrGroup, number> = {
  'not-open': 0,
  draft: 1,
  reviewable: 2,
  reviewed: 3,
  closed: 4,
  merged: 5,
};

function storageKey(workspaceId: WorkspaceId): string {
  return `${STORAGE_PREFIXES.sessionView}${workspaceId}`;
}

function readFromStorage(workspaceId: WorkspaceId): SessionViewPrefs {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as Record<string, unknown>)['v'] !== 1
    ) {
      writeToStorage(workspaceId, DEFAULT_PREFS);
      return DEFAULT_PREFS;
    }
    const obj = parsed as Record<string, unknown>;
    const sort = VALID_SORTS.has(obj['sort'] as SessionSortKey)
      ? (obj['sort'] as SessionSortKey)
      : DEFAULT_PREFS.sort;
    const group = VALID_GROUPS.has(obj['group'] as SessionGroupKey)
      ? (obj['group'] as SessionGroupKey)
      : DEFAULT_PREFS.group;
    const prefs: SessionViewPrefs = { sort, group };
    if (sort !== obj['sort'] || group !== obj['group']) {
      writeToStorage(workspaceId, prefs);
    }
    return prefs;
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeToStorage(workspaceId: WorkspaceId, prefs: SessionViewPrefs): void {
  try {
    const persisted: PersistedSessionViewPrefs = { v: 1, ...prefs };
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(persisted));
  } catch {
    // Swallow quota errors, prefs are non-critical.
  }
}

export interface SessionViewSliceState {
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
}

export interface SessionViewSliceActions {
  getSessionViewPrefs(workspaceId: WorkspaceId): SessionViewPrefs;
  setSessionSort(workspaceId: WorkspaceId, sort: SessionSortKey): void;
  setSessionGroup(workspaceId: WorkspaceId, group: SessionGroupKey): void;
}

export type SessionViewSlice = SessionViewSliceState & SessionViewSliceActions;

export function createSessionViewSlice(set: SetFn, get: GetFn): SessionViewSlice {
  return {
    sessionViewPrefs: {},

    getSessionViewPrefs(workspaceId) {
      const cached = get().sessionViewPrefs[workspaceId];
      if (cached) return cached;
      const prefs = readFromStorage(workspaceId);
      set((s) => ({
        sessionViewPrefs: { ...s.sessionViewPrefs, [workspaceId]: prefs },
      }));
      return prefs;
    },

    setSessionSort(workspaceId, sort) {
      const current = get().sessionViewPrefs[workspaceId] ?? readFromStorage(workspaceId);
      const next: SessionViewPrefs = { ...current, sort };
      writeToStorage(workspaceId, next);
      set((s) => ({
        sessionViewPrefs: { ...s.sessionViewPrefs, [workspaceId]: next },
      }));
    },

    setSessionGroup(workspaceId, group) {
      const current = get().sessionViewPrefs[workspaceId] ?? readFromStorage(workspaceId);
      const next: SessionViewPrefs = { ...current, group };
      writeToStorage(workspaceId, next);
      set((s) => ({
        sessionViewPrefs: { ...s.sessionViewPrefs, [workspaceId]: next },
      }));
    },
  };
}

function compareStrLocale(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function sortSessions(sessions: ReadonlyArray<Session>, sort: SessionSortKey): Session[] {
  const copy = [...sessions];
  switch (sort) {
    case 'updatedAt':
      return copy.sort((a, b) => {
        const diff = b.updatedAt.localeCompare(a.updatedAt);
        return diff !== 0 ? diff : b.createdAt.localeCompare(a.createdAt);
      });
    case 'goal':
      return copy.sort((a, b) => {
        const diff = compareStrLocale(a.goal, b.goal);
        return diff !== 0 ? diff : b.updatedAt.localeCompare(a.updatedAt);
      });
    case 'createdAt':
      return copy.sort((a, b) => {
        const diff = a.createdAt.localeCompare(b.createdAt);
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      });
  }
}

function userStatusBucket(status: SessionUserStatus): SessionUserStatusGroup {
  switch (status) {
    case 'wip':
      return 'wip';
    case 'waiting':
      return 'waiting';
    case 'blocked':
      return 'blocked';
    case 'done':
      return 'done';
  }
}

function prBucket(github: SessionGithubState | undefined): SessionPrGroup {
  const pr = github?.pr;
  if (!pr) return 'not-open';
  if (pr.state === 'closed') return 'closed';
  if (pr.state === 'merged') return 'merged';
  if (pr.isDraft) return 'draft';
  if (pr.reviewDecision === 'approved') return 'reviewed';
  return 'reviewable';
}

export interface GroupedSessions {
  readonly key: string;
  readonly sessions: ReadonlyArray<Session>;
}

export function sortAndGroupSessions(
  sessions: ReadonlyArray<Session>,
  prefs: SessionViewPrefs,
  githubState: Readonly<Record<SessionId, SessionGithubState>>,
): ReadonlyArray<GroupedSessions> {
  const sorted = sortSessions(sessions, prefs.sort);

  if (prefs.group === 'none') {
    return [{ key: 'all', sessions: sorted }];
  }

  if (prefs.group === 'userStatus') {
    const buckets = new Map<SessionUserStatusGroup, Session[]>();
    for (const s of sorted) {
      const bucket = userStatusBucket(s.userStatus);
      let arr = buckets.get(bucket);
      if (!arr) {
        arr = [];
        buckets.set(bucket, arr);
      }
      arr.push(s);
    }
    return (Object.keys(USER_STATUS_ORDER) as SessionUserStatusGroup[])
      .filter((k) => buckets.has(k))
      .map((k) => ({ key: k, sessions: buckets.get(k)! }));
  }

  const buckets = new Map<SessionPrGroup, Session[]>();
  for (const s of sorted) {
    const bucket = prBucket(githubState[s.id]);
    let arr = buckets.get(bucket);
    if (!arr) {
      arr = [];
      buckets.set(bucket, arr);
    }
    arr.push(s);
  }
  return (Object.keys(PR_GROUP_ORDER) as SessionPrGroup[])
    .filter((k) => buckets.has(k))
    .map((k) => ({ key: k, sessions: buckets.get(k)! }));
}
