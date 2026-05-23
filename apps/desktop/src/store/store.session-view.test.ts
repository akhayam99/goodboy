import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { SessionGithubState } from './store';
import {
  createSessionViewSlice,
  sortAndGroupSessions,
  type GroupedSessions,
} from './slices/session-view.slice';
import type { SessionViewPrefs } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../shared/lib/storage-keys';

// ─── helpers ────────────────────────────────────────────────────────────────

function sid(n: number): SessionId {
  return `session-${n}` as SessionId;
}

const WS = 'ws-1' as WorkspaceId;

function makeSession(
  id: SessionId,
  overrides: Partial<{
    goal: string;
    createdAt: string;
    updatedAt: string;
    userStatus: Session['userStatus'];
  }> = {},
): Session {
  return {
    id,
    workspaceId: WS,
    goal: overrides.goal ?? 'default goal',
    state: { kind: 'idle', lastActivityAt: '2024-01-01T00:00:00.000Z' as Session['createdAt'] },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    userStatus: overrides.userStatus ?? 'wip',
    createdAt: (overrides.createdAt ?? '2024-01-01T00:00:00.000Z') as Session['createdAt'],
    updatedAt: (overrides.updatedAt ?? '2024-01-01T00:00:00.000Z') as Session['updatedAt'],
  };
}

function makePr(
  overrides: Partial<{
    state: 'draft' | 'open' | 'approved' | 'merged' | 'closed';
    isDraft: boolean;
    reviewDecision: 'approved' | 'changes_requested' | 'review_required' | null;
  }> = {},
): NonNullable<SessionGithubState['pr']> {
  return {
    number: 1,
    title: 'test pr',
    url: 'https://github.com/x/y/pull/1',
    state: overrides.state ?? 'open',
    mergeable: null,
    checks: null,
    baseBranch: 'main',
    headBranch: 'feat/x',
    isDraft: overrides.isDraft ?? false,
    reviewDecision: overrides.reviewDecision ?? null,
    body: '',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function githubWith(
  entries: Array<{ id: SessionId; pr: SessionGithubState['pr'] }>,
): Readonly<Record<SessionId, SessionGithubState>> {
  const result: Record<SessionId, SessionGithubState> = {};
  for (const e of entries) {
    result[e.id] = {
      pr: e.pr,
      linkedIssues: [],
      fetchedAt: null,
      loading: false,
      error: null,
      detail: null,
      detailFetchedAt: null,
      detailLoading: false,
      detailError: null,
    };
  }
  return result;
}

function keys(groups: ReadonlyArray<GroupedSessions>): string[] {
  return groups.map((g) => g.key);
}

function flatIds(groups: ReadonlyArray<GroupedSessions>): SessionId[] {
  return groups.flatMap((g) => g.sessions.map((s) => s.id));
}

// ─── sort tests ─────────────────────────────────────────────────────────────

describe('sortAndGroupSessions — updatedAt sort', () => {
  const s1 = makeSession(sid(1), {
    updatedAt: '2024-01-03T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
  });
  const s2 = makeSession(sid(2), {
    updatedAt: '2024-01-05T00:00:00.000Z',
    createdAt: '2024-01-02T00:00:00.000Z',
  });
  const s3 = makeSession(sid(3), {
    updatedAt: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-03T00:00:00.000Z',
  });
  const prefs: SessionViewPrefs = { sort: 'updatedAt', group: 'none' };

  it('orders newest-updated first', () => {
    const result = sortAndGroupSessions([s1, s3, s2], prefs, {});
    expect(flatIds(result)).toEqual([sid(2), sid(1), sid(3)]);
  });

  it('returns single group keyed "all"', () => {
    const result = sortAndGroupSessions([s1], prefs, {});
    expect(keys(result)).toEqual(['all']);
  });

  it('tie-breaks by createdAt desc', () => {
    const a = makeSession(sid(10), {
      updatedAt: '2024-01-02T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    const b = makeSession(sid(11), {
      updatedAt: '2024-01-02T00:00:00.000Z',
      createdAt: '2024-01-03T00:00:00.000Z',
    });
    const result = sortAndGroupSessions([a, b], prefs, {});
    expect(flatIds(result)).toEqual([sid(11), sid(10)]);
  });

  it('empty input → single empty group', () => {
    const result = sortAndGroupSessions([], prefs, {});
    expect(result).toHaveLength(1);
    expect(result[0]!.sessions).toHaveLength(0);
  });
});

describe('sortAndGroupSessions — goal sort', () => {
  const prefs: SessionViewPrefs = { sort: 'goal', group: 'none' };

  it('orders A→Z case-insensitively', () => {
    const a = makeSession(sid(1), { goal: 'Zebra' });
    const b = makeSession(sid(2), { goal: 'apple' });
    const c = makeSession(sid(3), { goal: 'mango' });
    const result = sortAndGroupSessions([a, c, b], prefs, {});
    expect(flatIds(result)).toEqual([sid(2), sid(3), sid(1)]);
  });

  it('tie-breaks by updatedAt desc', () => {
    const a = makeSession(sid(1), { goal: 'same', updatedAt: '2024-01-01T00:00:00.000Z' });
    const b = makeSession(sid(2), { goal: 'same', updatedAt: '2024-01-03T00:00:00.000Z' });
    const result = sortAndGroupSessions([a, b], prefs, {});
    expect(flatIds(result)).toEqual([sid(2), sid(1)]);
  });
});

describe('sortAndGroupSessions — createdAt sort', () => {
  const prefs: SessionViewPrefs = { sort: 'createdAt', group: 'none' };

  it('orders oldest first', () => {
    const a = makeSession(sid(1), { createdAt: '2024-01-03T00:00:00.000Z' });
    const b = makeSession(sid(2), { createdAt: '2024-01-01T00:00:00.000Z' });
    const c = makeSession(sid(3), { createdAt: '2024-01-02T00:00:00.000Z' });
    const result = sortAndGroupSessions([a, b, c], prefs, {});
    expect(flatIds(result)).toEqual([sid(2), sid(3), sid(1)]);
  });

  it('tie-breaks by id asc', () => {
    const a = makeSession(sid(10), { createdAt: '2024-01-01T00:00:00.000Z' });
    const b = makeSession(sid(9), { createdAt: '2024-01-01T00:00:00.000Z' });
    const result = sortAndGroupSessions([a, b], prefs, {});
    // lexicographic id sort: 'session-10' < 'session-9'
    expect(flatIds(result)[0]).toBe(sid(10));
    expect(flatIds(result)[1]).toBe(sid(9));
  });
});

// ─── userStatus grouping ─────────────────────────────────────────────────────

describe('sortAndGroupSessions — userStatus grouping', () => {
  const prefs: SessionViewPrefs = { sort: 'updatedAt', group: 'userStatus' };

  it('produces groups in wip→waiting→blocked→done order', () => {
    const wip = makeSession(sid(1), { userStatus: 'wip' });
    const done = makeSession(sid(2), { userStatus: 'done' });
    const blocked = makeSession(sid(3), { userStatus: 'blocked' });
    const waiting = makeSession(sid(4), { userStatus: 'waiting' });
    const result = sortAndGroupSessions([done, waiting, blocked, wip], prefs, {});
    expect(keys(result)).toEqual(['wip', 'waiting', 'blocked', 'done']);
  });

  it('omits empty buckets', () => {
    const wip = makeSession(sid(1), { userStatus: 'wip' });
    const done = makeSession(sid(2), { userStatus: 'done' });
    const result = sortAndGroupSessions([wip, done], prefs, {});
    expect(keys(result)).toEqual(['wip', 'done']);
  });

  it('sessions within group are sorted', () => {
    const a = makeSession(sid(1), { userStatus: 'wip', updatedAt: '2024-01-01T00:00:00.000Z' });
    const b = makeSession(sid(2), { userStatus: 'wip', updatedAt: '2024-01-05T00:00:00.000Z' });
    const result = sortAndGroupSessions([a, b], prefs, {});
    expect(result[0]!.sessions.map((s) => s.id)).toEqual([sid(2), sid(1)]);
  });

  it('single-status input → one group', () => {
    const sessions = [sid(1), sid(2), sid(3)].map((id) =>
      makeSession(id, { userStatus: 'waiting' }),
    );
    const result = sortAndGroupSessions(sessions, prefs, {});
    expect(keys(result)).toEqual(['waiting']);
    expect(result[0]!.sessions).toHaveLength(3);
  });
});

// ─── PR grouping ─────────────────────────────────────────────────────────────

describe('sortAndGroupSessions — pr grouping', () => {
  const prefs: SessionViewPrefs = { sort: 'updatedAt', group: 'pr' };

  it('no PR → not-open bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions([s], prefs, {});
    expect(keys(result)).toEqual(['not-open']);
  });

  it('pr.state=closed → closed bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ state: 'closed' }) }]),
    );
    expect(keys(result)).toEqual(['closed']);
  });

  it('pr.state=merged → merged bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ state: 'merged' }) }]),
    );
    expect(keys(result)).toEqual(['merged']);
  });

  it('pr.isDraft=true → draft bucket (before reviewDecision check)', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ isDraft: true, reviewDecision: 'approved' }) }]),
    );
    expect(keys(result)).toEqual(['draft']);
  });

  it('reviewDecision=approved + not draft → reviewed bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ isDraft: false, reviewDecision: 'approved' }) }]),
    );
    expect(keys(result)).toEqual(['reviewed']);
  });

  it('open pr, not draft, no approval → reviewable bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([
        {
          id: sid(1),
          pr: makePr({ state: 'open', isDraft: false, reviewDecision: 'review_required' }),
        },
      ]),
    );
    expect(keys(result)).toEqual(['reviewable']);
  });

  it('all 6 pr buckets present → correct order', () => {
    const sessions = [sid(1), sid(2), sid(3), sid(4), sid(5), sid(6)].map((id) => makeSession(id));
    const github = githubWith([
      { id: sid(1), pr: null },
      { id: sid(2), pr: makePr({ isDraft: true }) },
      { id: sid(3), pr: makePr({ isDraft: false, reviewDecision: 'review_required' }) },
      { id: sid(4), pr: makePr({ isDraft: false, reviewDecision: 'approved' }) },
      { id: sid(5), pr: makePr({ state: 'closed' }) },
      { id: sid(6), pr: makePr({ state: 'merged' }) },
    ]);
    const result = sortAndGroupSessions(sessions, prefs, github);
    expect(keys(result)).toEqual([
      'not-open',
      'draft',
      'reviewable',
      'reviewed',
      'closed',
      'merged',
    ]);
  });

  it('closed takes precedence over isDraft=true', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ state: 'closed', isDraft: true }) }]),
    );
    expect(keys(result)).toEqual(['closed']);
  });

  it('omits empty pr buckets', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions([s], prefs, githubWith([{ id: sid(1), pr: null }]));
    expect(keys(result)).not.toContain('draft');
    expect(keys(result)).not.toContain('merged');
  });

  it('sessions in a bucket retain inner sort', () => {
    const a = makeSession(sid(1), { updatedAt: '2024-01-01T00:00:00.000Z' });
    const b = makeSession(sid(2), { updatedAt: '2024-01-05T00:00:00.000Z' });
    const github = githubWith([
      { id: sid(1), pr: null },
      { id: sid(2), pr: null },
    ]);
    const result = sortAndGroupSessions([a, b], prefs, github);
    expect(result[0]!.sessions.map((s) => s.id)).toEqual([sid(2), sid(1)]);
  });
});

// ─── localStorage slice ──────────────────────────────────────────────────────

function buildLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      store[k] = v;
    }),
    removeItem: vi.fn((k: string) => {
      delete store[k];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(store)) delete store[k];
    }),
    store,
  };
}

function storageKey(workspaceId: WorkspaceId): string {
  return `${STORAGE_PREFIXES.sessionView}${workspaceId}`;
}

type SliceState = ReturnType<typeof createSessionViewSlice>;

function buildSlice(): { actions: SliceState; getState: () => SliceState } {
  let state = {} as SliceState;

  function set(updater: Partial<SliceState> | ((s: SliceState) => Partial<SliceState>)) {
    const patch = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...patch };
  }

  function get(): SliceState {
    return state;
  }

  const actions = createSessionViewSlice(
    set as Parameters<typeof createSessionViewSlice>[0],
    get as Parameters<typeof createSessionViewSlice>[1],
  );
  state = { ...actions };

  return { actions, getState: get };
}

describe('createSessionViewSlice — getSessionViewPrefs', () => {
  let ls: ReturnType<typeof buildLocalStorageMock>;

  beforeEach(() => {
    ls = buildLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
  });

  it('returns defaults when localStorage is empty', () => {
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'none' });
  });

  it('reads persisted prefs from localStorage', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'goal', group: 'userStatus' });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'goal', group: 'userStatus' });
  });

  it('caches result — second call does not re-read localStorage', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'createdAt', group: 'pr' });
    const { actions } = buildSlice();
    actions.getSessionViewPrefs(WS);
    const callCountAfterFirst = ls.getItem.mock.calls.length;
    actions.getSessionViewPrefs(WS);
    expect(ls.getItem.mock.calls.length).toBe(callCountAfterFirst);
  });
});

describe('createSessionViewSlice — setSessionSort', () => {
  let ls: ReturnType<typeof buildLocalStorageMock>;

  beforeEach(() => {
    ls = buildLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
  });

  it('updates sessionViewPrefs state', () => {
    const { actions, getState } = buildSlice();
    actions.getSessionViewPrefs(WS);
    actions.setSessionSort(WS, 'goal');
    expect(getState().sessionViewPrefs[WS]?.sort).toBe('goal');
  });

  it('persists to localStorage', () => {
    const { actions } = buildSlice();
    actions.setSessionSort(WS, 'createdAt');
    const raw = ls.store[storageKey(WS)]!;
    expect(raw).toBeDefined();
    expect(JSON.parse(raw)).toMatchObject({ v: 1, sort: 'createdAt' });
  });

  it('preserves existing group when changing sort', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'updatedAt', group: 'pr' });
    const { actions, getState } = buildSlice();
    actions.getSessionViewPrefs(WS);
    actions.setSessionSort(WS, 'goal');
    expect(getState().sessionViewPrefs[WS]).toEqual({ sort: 'goal', group: 'pr' });
  });

  it('works even if prefs never hydrated (cold write)', () => {
    const { actions } = buildSlice();
    actions.setSessionSort(WS, 'goal');
    expect(JSON.parse(ls.store[storageKey(WS)]!).sort).toBe('goal');
  });
});

describe('createSessionViewSlice — setSessionGroup', () => {
  let ls: ReturnType<typeof buildLocalStorageMock>;

  beforeEach(() => {
    ls = buildLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
  });

  it('updates group in state', () => {
    const { actions, getState } = buildSlice();
    actions.setSessionGroup(WS, 'pr');
    expect(getState().sessionViewPrefs[WS]?.group).toBe('pr');
  });

  it('persists group to localStorage', () => {
    const { actions } = buildSlice();
    actions.setSessionGroup(WS, 'userStatus');
    expect(JSON.parse(ls.store[storageKey(WS)]!).group).toBe('userStatus');
  });

  it('preserves existing sort when changing group', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'createdAt', group: 'none' });
    const { actions, getState } = buildSlice();
    actions.getSessionViewPrefs(WS);
    actions.setSessionGroup(WS, 'userStatus');
    expect(getState().sessionViewPrefs[WS]).toEqual({ sort: 'createdAt', group: 'userStatus' });
  });
});

describe('createSessionViewSlice — localStorage fault tolerance', () => {
  let ls: ReturnType<typeof buildLocalStorageMock>;

  beforeEach(() => {
    ls = buildLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
  });

  it('corrupted JSON → returns defaults', () => {
    ls.store[storageKey(WS)] = 'not json!!!';
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'none' });
  });

  it('wrong version number → returns defaults and self-heals', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 99, sort: 'goal', group: 'pr' });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'none' });
    expect(JSON.parse(ls.store[storageKey(WS)]!)).toMatchObject({
      v: 1,
      sort: 'updatedAt',
      group: 'none',
    });
  });

  it('invalid sort value → falls back to default sort, self-heals', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'invalid', group: 'pr' });
    const { actions } = buildSlice();
    const prefs = actions.getSessionViewPrefs(WS);
    expect(prefs.sort).toBe('updatedAt');
    expect(prefs.group).toBe('pr');
    expect(JSON.parse(ls.store[storageKey(WS)]!).sort).toBe('updatedAt');
  });

  it('invalid group value → falls back to default group, self-heals', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'goal', group: 'invalid' });
    const { actions } = buildSlice();
    const prefs = actions.getSessionViewPrefs(WS);
    expect(prefs.sort).toBe('goal');
    expect(prefs.group).toBe('none');
  });

  it('missing localStorage key → returns defaults', () => {
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'none' });
  });

  it('localStorage.getItem throws → returns defaults', () => {
    ls.getItem.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'none' });
  });

  it('localStorage.setItem quota error → swallowed, state still updated', () => {
    ls.setItem.mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError');
    });
    const { actions, getState } = buildSlice();
    expect(() => actions.setSessionSort(WS, 'goal')).not.toThrow();
    expect(getState().sessionViewPrefs[WS]?.sort).toBe('goal');
  });

  it('valid prefs with all-default values → no self-heal write', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'updatedAt', group: 'none' });
    const { actions } = buildSlice();
    const countBefore = ls.setItem.mock.calls.length;
    actions.getSessionViewPrefs(WS);
    expect(ls.setItem.mock.calls.length).toBe(countBefore);
  });
});

describe('createSessionViewSlice — per-workspace isolation', () => {
  const WS2 = 'ws-2' as WorkspaceId;
  let ls: ReturnType<typeof buildLocalStorageMock>;

  beforeEach(() => {
    ls = buildLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'goal', group: 'userStatus' });
    ls.store[storageKey(WS2)] = JSON.stringify({ v: 1, sort: 'createdAt', group: 'pr' });
  });

  it('each workspace has independent prefs', () => {
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'goal', group: 'userStatus' });
    expect(actions.getSessionViewPrefs(WS2)).toEqual({ sort: 'createdAt', group: 'pr' });
  });

  it('setSessionSort on ws1 does not affect ws2', () => {
    const { actions, getState } = buildSlice();
    actions.getSessionViewPrefs(WS);
    actions.getSessionViewPrefs(WS2);
    actions.setSessionSort(WS, 'updatedAt');
    expect(getState().sessionViewPrefs[WS2]?.sort).toBe('createdAt');
  });
});

// ─── performance ─────────────────────────────────────────────────────────────

describe('sortAndGroupSessions — performance', () => {
  it('handles 2000 sessions in under 500ms', () => {
    const sessions = Array.from({ length: 2000 }, (_, i) => {
      const day = String((i % 365) + 1).padStart(3, '0');
      return makeSession(sid(i), {
        goal: `Goal ${Math.random().toString(36).slice(2)}`,
        createdAt: `2024-01-${String((i % 30) + 1).padStart(2, '0')}T00:00:00.000Z`,
        updatedAt: `2024-01-${String((i % 30) + 1).padStart(2, '0')}T0${i % 10}:00:00.000Z`,
        userStatus: (['wip', 'waiting', 'blocked', 'done'] as const)[i % 4],
      });
    });

    const githubStates = githubWith(
      sessions.map((s, i) => ({
        id: s.id,
        pr:
          i % 5 === 0
            ? null
            : makePr({ isDraft: i % 3 === 0, reviewDecision: i % 7 === 0 ? 'approved' : null }),
      })),
    );

    const start = performance.now();
    for (const sort of ['updatedAt', 'goal', 'createdAt'] as const) {
      for (const group of ['none', 'userStatus', 'pr'] as const) {
        sortAndGroupSessions(sessions, { sort, group }, githubStates);
      }
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });
});
