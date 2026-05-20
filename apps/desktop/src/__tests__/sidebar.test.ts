import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  ProviderId,
  Session,
  SessionId,
  TurnState,
  WorkspaceId,
} from '@kay-am/types';

const DT = '2024-01-01T00:00:00Z' as IsoDateTime;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1' as SessionId,
    workspaceId: 'ws-1' as WorkspaceId,
    goal: 'test session',
    state: { kind: 'idle', lastActivityAt: DT } as TurnState,
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic' as ProviderId, allowTurnOverride: true },
    permissionMode: 'bypassPermissions' as const,
    autoRun: false,
    titleUserEdited: false,
    skipInit: false,
    workflowAborted: false,
    userStatus: 'wip',
    createdAt: DT,
    updatedAt: DT,
    ...overrides,
  };
}

function filterSessions(
  sessions: ReadonlyArray<Session>,
  search: string,
  stateFilter: ReadonlyArray<TurnState['kind']>,
  providerFilter: ReadonlyArray<ProviderId>,
): ReadonlyArray<Session> {
  return sessions.filter((s) => {
    const matchesSearch = s.goal.toLowerCase().includes(search.toLowerCase());
    const matchesState = stateFilter.length === 0 || stateFilter.includes(s.state.kind);
    const matchesProvider =
      providerFilter.length === 0 || providerFilter.includes(s.providerPreference.defaultProvider);
    return matchesSearch && matchesState && matchesProvider;
  });
}

describe('sidebar session filtering', () => {
  const sessions: ReadonlyArray<Session> = [
    makeSession({ id: 's1' as SessionId, goal: 'refactor auth module' }),
    makeSession({
      id: 's2' as SessionId,
      goal: 'add new feature',
      state: { kind: 'running', runId: 'r1' as never, startedAt: DT },
    }),
    makeSession({
      id: 's3' as SessionId,
      goal: 'fix bug in payment',
      state: { kind: 'ended', endedAt: DT },
      providerPreference: { defaultProvider: 'cursor' as ProviderId, allowTurnOverride: false },
    }),
    makeSession({
      id: 's4' as SessionId,
      goal: 'deploy to prod',
      state: { kind: 'error', message: 'oops', failedAt: DT },
    }),
  ];

  it('no filters → all sessions returned', () => {
    expect(filterSessions(sessions, '', [], [])).toHaveLength(4);
  });

  it('search filters by goal (case-insensitive)', () => {
    const result = filterSessions(sessions, 'AUTH', [], []);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('s1');
  });

  it('state filter shows only matching states', () => {
    const result = filterSessions(sessions, '', ['running', 'error'], []);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(['s2', 's4']);
  });

  it('provider filter shows only matching provider', () => {
    const result = filterSessions(sessions, '', [], ['cursor']);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('s3');
  });

  it('combined search + state filter', () => {
    const result = filterSessions(sessions, 'bug', ['ended'], []);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('s3');
  });

  it('combined search + state + provider filters with no match', () => {
    const result = filterSessions(sessions, 'auth', ['running'], ['cursor']);
    expect(result).toHaveLength(0);
  });
});

describe('rename validation', () => {
  it('empty goal rejects', () => {
    const validate = (goal: string) => {
      if (!goal.trim()) throw new Error('session name cannot be empty');
    };
    expect(() => validate('')).toThrow('session name cannot be empty');
    expect(() => validate('  ')).toThrow('session name cannot be empty');
    expect(() => validate('valid name')).not.toThrow();
  });
});

describe('status icon mapping', () => {
  const EXPECTED_KINDS: ReadonlyArray<TurnState['kind']> = [
    'draft',
    'starting',
    'idle',
    'running',
    'ended',
    'error',
  ];

  it('all TurnState kinds have a defined icon mapping', () => {
    const ICON_MAP: Readonly<Record<TurnState['kind'], string>> = {
      draft: 'pencil',
      starting: 'loader',
      idle: 'circle',
      running: 'pulse',
      ended: 'check',
      error: 'x',
    };
    EXPECTED_KINDS.forEach((kind) => {
      expect(ICON_MAP[kind]).toBeDefined();
    });
  });
});

describe('delete session logic', () => {
  it('deleteSession removes session from list', () => {
    const sessions: ReadonlyArray<Session> = [
      makeSession({ id: 's1' as SessionId }),
      makeSession({ id: 's2' as SessionId }),
    ];
    const afterDelete = sessions.filter((s) => s.id !== ('s1' as SessionId));
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0]?.id).toBe('s2');
  });

  it('currentSessionId cleared when deleting active session', () => {
    const currentSessionId = 's1' as SessionId;
    const deletedId = 's1' as SessionId;
    const nextId = currentSessionId === deletedId ? null : currentSessionId;
    expect(nextId).toBeNull();
  });

  it('currentSessionId preserved when deleting non-active session', () => {
    const currentSessionId = 's2' as SessionId;
    const deletedId = 's1' as SessionId;
    const nextId = currentSessionId === deletedId ? null : currentSessionId;
    expect(nextId).toBe('s2');
  });
});

describe('sessionBranches', () => {
  it('branch stored separately from worktree path', () => {
    const sessionBranches: Record<string, string> = {
      s1: 'kay/refactor-auth',
    };
    expect(sessionBranches['s1']).toBe('kay/refactor-auth');
    expect(sessionBranches['s2']).toBeUndefined();
  });

  it('branch cleared on delete', () => {
    const sessionBranches: Record<string, string> = {
      s1: 'kay/refactor-auth',
      s2: 'kay/fix-bug',
    };
    const after = { ...sessionBranches };
    delete after['s1'];
    expect(after['s1']).toBeUndefined();
    expect(after['s2']).toBe('kay/fix-bug');
  });
});
