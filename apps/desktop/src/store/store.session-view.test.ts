import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId, SessionStage, WorkspaceId } from '@goodboy/types';
import type { SessionGithubState } from './types';
import {
  createSessionViewSlice,
  deriveSessionStage,
  sortAndGroupSessions,
  type GroupedSessions,
} from './slices/session-view';
import type { SessionViewPrefs } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../shared/lib/storage-keys';
import { STAGE_ORDER } from './slices/session-view/types';

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
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: false,
    createdAt: (overrides.createdAt ?? '2024-01-01T00:00:00.000Z') as Session['createdAt'],
    updatedAt: (overrides.updatedAt ?? '2024-01-01T00:00:00.000Z') as Session['updatedAt'],
  };
}

function makePr(
  overrides: Partial<{
    state: 'draft' | 'open' | 'approved' | 'queued' | 'merged' | 'closed';
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

describe('sortAndGroupSessions, updatedAt sort', () => {
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

describe('sortAndGroupSessions, goal sort', () => {
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

describe('sortAndGroupSessions, createdAt sort', () => {
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
    expect(flatIds(result)[0]).toBe(sid(10));
    expect(flatIds(result)[1]).toBe(sid(9));
  });
});

describe('sortAndGroupSessions, stage grouping', () => {
  const prefs: SessionViewPrefs = { sort: 'updatedAt', group: 'stage' };

  it('produces groups in building→running→attention→review→done order', () => {
    const sessions = [sid(1), sid(2), sid(3), sid(4), sid(5)].map((id) => makeSession(id));
    const result = sortAndGroupSessions(
      sessions,
      prefs,
      {},
      {
        [sid(1)]: 'done',
        [sid(2)]: 'building',
        [sid(3)]: 'review',
        [sid(4)]: 'running',
        [sid(5)]: 'attention',
      },
    );
    expect(keys(result)).toEqual(['building', 'running', 'attention', 'review', 'done']);
  });

  it('omits empty buckets', () => {
    const result = sortAndGroupSessions(
      [makeSession(sid(1)), makeSession(sid(2))],
      prefs,
      {},
      {
        [sid(1)]: 'attention',
        [sid(2)]: 'done',
      },
    );
    expect(keys(result)).toEqual(['attention', 'done']);
  });

  it('sessions within group are sorted', () => {
    const a = makeSession(sid(1), { updatedAt: '2024-01-01T00:00:00.000Z' });
    const b = makeSession(sid(2), { updatedAt: '2024-01-05T00:00:00.000Z' });
    const result = sortAndGroupSessions(
      [a, b],
      prefs,
      {},
      {
        [sid(1)]: 'running',
        [sid(2)]: 'running',
      },
    );
    expect(result[0]!.sessions.map((s) => s.id)).toEqual([sid(2), sid(1)]);
  });

  it('missing stage falls back to building', () => {
    const result = sortAndGroupSessions([makeSession(sid(1))], prefs, {}, {});
    expect(keys(result)).toEqual(['building']);
  });
});

describe('deriveSessionStage', () => {
  const base = (id: number) => makeSession(sid(id));
  const signals = { hasUnread: false, openQuestionCount: 0 };

  it('error state wins over everything', () => {
    const session: Session = {
      ...base(1),
      state: { kind: 'error', message: 'boom', failedAt: '2024-01-01T00:00:00.000Z' as never },
    };
    const info = deriveSessionStage({ session, pr: makePr(), ...signals, hasUnread: true });
    expect(info.stage).toBe('attention');
    expect(info.reason).toBe('agent errored');
  });

  it('running state beats attention signals', () => {
    const session: Session = {
      ...base(1),
      state: {
        kind: 'running',
        runId: 'run-1' as never,
        startedAt: '2024-01-01T00:00:00.000Z' as never,
      },
    };
    const info = deriveSessionStage({ session, pr: null, ...signals, openQuestionCount: 2 });
    expect(info.stage).toBe('running');
  });

  it('CI failure on live PR → attention', () => {
    const pr = { ...makePr(), checks: 'failure' as const };
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({ stage: 'attention', reason: 'PR #1: CI failed' });
  });

  it('changes requested → attention', () => {
    const pr = makePr({ reviewDecision: 'changes_requested' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({ stage: 'attention', reason: 'PR #1: changes requested' });
  });

  it('open questions → attention with count', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: false,
      openQuestionCount: 3,
    });
    expect(info).toEqual({ stage: 'attention', reason: '3 open questions' });
  });

  it('approved live PR → attention, ready to merge', () => {
    const pr = makePr({ state: 'approved', reviewDecision: 'approved' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({ stage: 'attention', reason: 'PR #1 approved, ready to merge' });
  });

  it('unread reply → attention', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: true,
      openQuestionCount: 0,
    });
    expect(info).toEqual({ stage: 'attention', reason: 'unread agent reply' });
  });

  it('no PR and quiet → building', () => {
    const info = deriveSessionStage({ session: base(1), pr: null, ...signals });
    expect(info).toEqual({ stage: 'building', reason: 'no PR yet' });
  });

  it('open PR and quiet → review', () => {
    const info = deriveSessionStage({ session: base(1), pr: makePr(), ...signals });
    expect(info).toEqual({ stage: 'review', reason: 'PR #1 awaiting review' });
  });

  it('draft PR → review with draft reason', () => {
    const pr = makePr({ isDraft: true });
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({ stage: 'review', reason: 'draft PR #1' });
  });

  it('unread beats merged', () => {
    const pr = makePr({ state: 'merged' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals, hasUnread: true });
    expect(info.stage).toBe('attention');
  });

  it('merged PR and quiet → done', () => {
    const pr = makePr({ state: 'merged' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals });
    expect(info).toEqual({ stage: 'done', reason: 'PR #1 merged' });
  });

  it('idle state + running standalone agent → running', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      ...signals,
      hasRunningAgent: true,
    });
    expect(info.stage).toBe('running');
  });

  it('error state + running agent → stays attention (error wins)', () => {
    const session: Session = {
      ...base(1),
      state: { kind: 'error', message: 'boom', failedAt: '2024-01-01T00:00:00.000Z' as never },
    };
    const info = deriveSessionStage({ session, pr: null, ...signals, hasRunningAgent: true });
    expect(info.stage).toBe('attention');
    expect(info.reason).toBe('agent errored');
  });

  it('running agent + CI failure on live PR → running (agent outranks CI attention)', () => {
    const pr = { ...makePr(), checks: 'failure' as const };
    const info = deriveSessionStage({ session: base(1), pr, ...signals, hasRunningAgent: true });
    expect(info.stage).toBe('running');
  });

  it('starting state → running', () => {
    const session: Session = {
      ...base(1),
      state: { kind: 'starting', startedAt: '2024-01-01T00:00:00.000Z' as never },
    };
    const info = deriveSessionStage({ session, pr: null, ...signals });
    expect(info).toEqual({ stage: 'running', reason: 'agent running' });
  });

  it('running agent outranks open questions', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: false,
      openQuestionCount: 4,
      hasRunningAgent: true,
    });
    expect(info.stage).toBe('running');
  });

  it('running agent on a merged PR → running, not done', () => {
    const pr = makePr({ state: 'merged' });
    const info = deriveSessionStage({ session: base(1), pr, ...signals, hasRunningAgent: true });
    expect(info.stage).toBe('running');
  });

  it('hasRunningAgent omitted → defaults to false (no running promotion)', () => {
    const info = deriveSessionStage({ session: base(1), pr: null, ...signals });
    expect(info.stage).toBe('building');
  });

  it('branchless sessions derive running from any active agent signal', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: null,
      ...signals,
      hasRunningAgent: true,
      isBranchless: true,
    });
    expect(info).toEqual({ stage: 'running', reason: 'agent running' });
  });

  it('branchless sessions derive attention from questions or unread replies', () => {
    const questions = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: false,
      openQuestionCount: 2,
      isBranchless: true,
    });
    const unread = deriveSessionStage({
      session: base(1),
      pr: null,
      hasUnread: true,
      openQuestionCount: 0,
      isBranchless: true,
    });
    expect(questions).toEqual({ stage: 'attention', reason: '2 open questions' });
    expect(unread).toEqual({ stage: 'attention', reason: 'unread agent reply' });
  });

  it('branchless sessions stay building when agent signals are quiet', () => {
    const info = deriveSessionStage({
      session: base(1),
      pr: makePr({ state: 'merged' }),
      ...signals,
      isBranchless: true,
    });
    expect(info).toEqual({ stage: 'building', reason: 'ready for work' });
  });
});

describe('sortAndGroupSessions, pr grouping', () => {
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

  it('pr.state=queued → queued bucket', () => {
    const s = makeSession(sid(1));
    const result = sortAndGroupSessions(
      [s],
      prefs,
      githubWith([{ id: sid(1), pr: makePr({ state: 'queued' }) }]),
    );
    expect(keys(result)).toEqual(['queued']);
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

  it('all 7 pr buckets present → correct order', () => {
    const sessions = [sid(1), sid(2), sid(3), sid(4), sid(5), sid(6), sid(7)].map((id) =>
      makeSession(id),
    );
    const github = githubWith([
      { id: sid(1), pr: null },
      { id: sid(2), pr: makePr({ isDraft: true }) },
      { id: sid(3), pr: makePr({ isDraft: false, reviewDecision: 'review_required' }) },
      { id: sid(4), pr: makePr({ isDraft: false, reviewDecision: 'approved' }) },
      { id: sid(5), pr: makePr({ state: 'queued' }) },
      { id: sid(6), pr: makePr({ state: 'closed' }) },
      { id: sid(7), pr: makePr({ state: 'merged' }) },
    ]);
    const result = sortAndGroupSessions(sessions, prefs, github);
    expect(keys(result)).toEqual([
      'not-open',
      'draft',
      'reviewable',
      'reviewed',
      'queued',
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

describe('createSessionViewSlice, getSessionViewPrefs', () => {
  let ls: ReturnType<typeof buildLocalStorageMock>;

  beforeEach(() => {
    ls = buildLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
  });

  it('returns defaults when localStorage is empty', () => {
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'stage' });
  });

  it('reads persisted prefs from localStorage', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'goal', group: 'stage' });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'goal', group: 'stage' });
  });

  it('caches result, second call does not re-read localStorage', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'createdAt', group: 'pr' });
    const { actions } = buildSlice();
    actions.getSessionViewPrefs(WS);
    const callCountAfterFirst = ls.getItem.mock.calls.length;
    actions.getSessionViewPrefs(WS);
    expect(ls.getItem.mock.calls.length).toBe(callCountAfterFirst);
  });
});

describe('createSessionViewSlice, setSessionSort', () => {
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

describe('createSessionViewSlice, setSessionGroup', () => {
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
    actions.setSessionGroup(WS, 'stage');
    expect(JSON.parse(ls.store[storageKey(WS)]!).group).toBe('stage');
  });

  it('preserves existing sort when changing group', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'createdAt', group: 'none' });
    const { actions, getState } = buildSlice();
    actions.getSessionViewPrefs(WS);
    actions.setSessionGroup(WS, 'stage');
    expect(getState().sessionViewPrefs[WS]).toEqual({ sort: 'createdAt', group: 'stage' });
  });
});

describe('createSessionViewSlice, localStorage fault tolerance', () => {
  let ls: ReturnType<typeof buildLocalStorageMock>;

  beforeEach(() => {
    ls = buildLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
  });

  it('corrupted JSON → returns defaults', () => {
    ls.store[storageKey(WS)] = 'not json!!!';
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'stage' });
  });

  it('wrong version number → returns defaults and self-heals', () => {
    ls.store[storageKey(WS)] = JSON.stringify({ v: 99, sort: 'goal', group: 'pr' });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'stage' });
    expect(JSON.parse(ls.store[storageKey(WS)]!)).toMatchObject({
      v: 1,
      sort: 'updatedAt',
      group: 'stage',
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
    expect(prefs.group).toBe('stage');
  });

  it('missing localStorage key → returns defaults', () => {
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'stage' });
  });

  it('localStorage.getItem throws → returns defaults', () => {
    ls.getItem.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'updatedAt', group: 'stage' });
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
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'updatedAt', group: 'stage' });
    const { actions } = buildSlice();
    const countBefore = ls.setItem.mock.calls.length;
    actions.getSessionViewPrefs(WS);
    expect(ls.setItem.mock.calls.length).toBe(countBefore);
  });
});

describe('createSessionViewSlice, per-workspace isolation', () => {
  const WS2 = 'ws-2' as WorkspaceId;
  let ls: ReturnType<typeof buildLocalStorageMock>;

  beforeEach(() => {
    ls = buildLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
    ls.store[storageKey(WS)] = JSON.stringify({ v: 1, sort: 'goal', group: 'stage' });
    ls.store[storageKey(WS2)] = JSON.stringify({ v: 1, sort: 'createdAt', group: 'pr' });
  });

  it('each workspace has independent prefs', () => {
    const { actions } = buildSlice();
    expect(actions.getSessionViewPrefs(WS)).toEqual({ sort: 'goal', group: 'stage' });
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

describe('sortAndGroupSessions, performance', () => {
  it('handles 2000 sessions in under 500ms', () => {
    const sessions = Array.from({ length: 2000 }, (_, i) => {
      return makeSession(sid(i), {
        goal: `Goal ${Math.random().toString(36).slice(2)}`,
        createdAt: `2024-01-${String((i % 30) + 1).padStart(2, '0')}T00:00:00.000Z`,
        updatedAt: `2024-01-${String((i % 30) + 1).padStart(2, '0')}T0${i % 10}:00:00.000Z`,
      });
    });

    const stages: Record<SessionId, SessionStage> = {};
    sessions.forEach((s, i) => {
      stages[s.id] = (['attention', 'running', 'review', 'building', 'done'] as const)[i % 5]!;
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
      for (const group of ['none', 'stage', 'pr'] as const) {
        sortAndGroupSessions(sessions, { sort, group }, githubStates, stages);
      }
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000);
  });
});

describe('STAGE_ORDER', () => {
  it('defines building(0) → running(1) → attention(2) → review(3) → done(4)', () => {
    expect(STAGE_ORDER).toEqual({
      building: 0,
      running: 1,
      attention: 2,
      review: 3,
      done: 4,
    });
  });

  it('sorted keys produce the expected column sequence', () => {
    const sorted = (Object.entries(STAGE_ORDER) as Array<[string, number]>)
      .sort((a, b) => a[1] - b[1])
      .map(([k]) => k);
    expect(sorted).toEqual(['building', 'running', 'attention', 'review', 'done']);
  });
});
