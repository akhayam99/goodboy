import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { resolveIssueSessions, useLinearIssues, type SessionPrRef } from './useLinearIssues';
import { buildIssueGroups } from './buildIssueGroups';
import { linearFetchAssignedIssues, type LinearAttachment, type LinearIssue } from '../client';
import { collectLinkedExternalIds } from '../../hooks/useLinkedExternalIds';
import { deferred } from '../../testing/deferred';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';

const WS_ONE = brandId<WorkspaceId>({ value: 'workspace-1' });
const WS_TWO = brandId<WorkspaceId>({ value: 'workspace-2' });

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  linearFetchAssignedIssues: vi.fn(),
}));

const fetchAssigned = vi.mocked(linearFetchAssignedIssues);

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  fetchAssigned.mockReset();
});

afterEach(cleanup);

function makeIssue(overrides: Partial<LinearIssue> = {}): LinearIssue {
  return {
    id: 'lin-1',
    identifier: 'SER-1',
    title: 'Issue one',
    description: null,
    url: 'https://linear.app/demo-team/issue/SER-1',
    state: { name: 'In Progress', type: 'started' },
    team: { key: 'SER' },
    updatedAt: '2026-05-21T10:00:00Z',
    ...overrides,
  };
}

function prAttachment(repo: string, number: number): LinearAttachment {
  return {
    id: `att-${number}`,
    title: null,
    url: `https://github.com/${repo}/pull/${number}`,
    sourceType: 'github',
    metadata: null,
  };
}

function session(id: string): Session {
  return { id: id as SessionId } as Session;
}

describe('buildIssueGroups', () => {
  it('orders groups started → unstarted → backlog → triage and drops empty buckets', () => {
    const issues = [
      makeIssue({ id: 'a', state: { name: 'Backlog', type: 'backlog' } }),
      makeIssue({ id: 'b', state: { name: 'Todo', type: 'unstarted' } }),
      makeIssue({ id: 'c', state: { name: 'In Progress', type: 'started' } }),
    ];
    const groups = buildIssueGroups({ issues, sessionIdByExternalId: new Map() });
    expect(groups.map((g) => g.key)).toEqual(['started', 'unstarted', 'backlog']);
    expect(groups.map((g) => g.label)).toEqual(['In Progress', 'Todo', 'Backlog']);
  });

  it('sorts rows within a group newest-first by updatedAt', () => {
    const issues = [
      makeIssue({ id: 'old', updatedAt: '2026-01-01T00:00:00Z' }),
      makeIssue({ id: 'new', updatedAt: '2026-05-01T00:00:00Z' }),
      makeIssue({ id: 'mid', updatedAt: '2026-03-01T00:00:00Z' }),
    ];
    const [group] = buildIssueGroups({ issues, sessionIdByExternalId: new Map() });
    expect(group?.rows.map((r) => r.issue.id)).toEqual(['new', 'mid', 'old']);
  });

  it('cross-links a row to an existing session by external id', () => {
    const issues = [makeIssue({ id: 'lin-x' }), makeIssue({ id: 'lin-y' })];
    const map = new Map<string, SessionId>([['lin-x', 'sess-1' as SessionId]]);
    const rows = buildIssueGroups({ issues, sessionIdByExternalId: map }).flatMap((g) => g.rows);
    expect(rows.find((r) => r.issue.id === 'lin-x')?.sessionId).toBe('sess-1');
    expect(rows.find((r) => r.issue.id === 'lin-y')?.sessionId).toBeNull();
  });

  it('falls back to the other bucket for unknown state types', () => {
    const groups = buildIssueGroups({
      issues: [makeIssue({ id: 'z', state: { name: 'Weird', type: 'mystery' } })],
      sessionIdByExternalId: new Map(),
    });
    expect(groups.map((g) => g.key)).toEqual(['other']);
  });
});

describe('resolveIssueSessions', () => {
  const linkedFor = (
    sessionExternalTasks: Record<string, ReadonlyArray<SessionExternalTask>>,
    sessions: ReadonlyArray<Session>,
  ) => collectLinkedExternalIds({ sessionExternalTasks, providers: ['linear'], sessions });
  const NO_BRANCHES: Record<string, string> = {};
  const NO_TASKS: Record<string, ReadonlyArray<SessionExternalTask>> = {};
  const NO_PRS = new Map<string, SessionPrRef>();

  it('links by external task', () => {
    const issue = makeIssue({ id: 'lin-x' });
    const tasks: Record<string, ReadonlyArray<SessionExternalTask>> = {
      s1: [{ externalId: 'lin-x', provider: 'linear' } as SessionExternalTask],
    };
    const map = resolveIssueSessions({
      issues: [issue],
      sessions: [session('s1')],
      sessionBranches: NO_BRANCHES,
      linkedSessions: linkedFor(tasks, [session('s1')]),
      sessionPr: NO_PRS,
    });
    expect(map.get('lin-x')).toBe('s1');
  });

  it('links by a shared pull request when no external task exists', () => {
    const issue = makeIssue({
      id: 'lin-x',
      attachments: { nodes: [prAttachment('acme/web', 42)] },
    });
    const prs = new Map<string, SessionPrRef>([['s1', { number: 42, repo: 'acme/web' }]]);
    const map = resolveIssueSessions({
      issues: [issue],
      sessions: [session('s1')],
      sessionBranches: NO_BRANCHES,
      linkedSessions: linkedFor(NO_TASKS, [session('s1')]),
      sessionPr: prs,
    });
    expect(map.get('lin-x')).toBe('s1');
  });

  it('does not link a same-numbered PR in a different repo', () => {
    const issue = makeIssue({
      id: 'lin-x',
      attachments: { nodes: [prAttachment('acme/web', 42)] },
    });
    const prs = new Map<string, SessionPrRef>([['s1', { number: 42, repo: 'other/repo' }]]);
    const map = resolveIssueSessions({
      issues: [issue],
      sessions: [session('s1')],
      sessionBranches: NO_BRANCHES,
      linkedSessions: linkedFor(NO_TASKS, [session('s1')]),
      sessionPr: prs,
    });
    expect(map.get('lin-x')).toBeUndefined();
  });

  it('links by exact Linear branch name', () => {
    const issue = makeIssue({ id: 'lin-x', branchName: 'amin/ser-1-fix' });
    const branches = { s1: 'amin/ser-1-fix' };
    const map = resolveIssueSessions({
      issues: [issue],
      sessions: [session('s1')],
      sessionBranches: branches,
      linkedSessions: linkedFor(NO_TASKS, [session('s1')]),
      sessionPr: NO_PRS,
    });
    expect(map.get('lin-x')).toBe('s1');
  });

  it('prefers the external-task link over a branch match', () => {
    const issue = makeIssue({ id: 'lin-x', branchName: 'amin/ser-1-fix' });
    const tasks: Record<string, ReadonlyArray<SessionExternalTask>> = {
      s2: [{ externalId: 'lin-x', provider: 'linear' } as SessionExternalTask],
    };
    const branches = { s1: 'amin/ser-1-fix' };
    const map = resolveIssueSessions({
      issues: [issue],
      sessions: [session('s1'), session('s2')],
      sessionBranches: branches,
      linkedSessions: linkedFor(tasks, [session('s1'), session('s2')]),
      sessionPr: NO_PRS,
    });
    expect(map.get('lin-x')).toBe('s2');
  });
});

describe('useLinearIssues late answers', () => {
  const idsOf = (groups: ReturnType<typeof useLinearIssues>['groups']) =>
    groups.flatMap((group) => group.rows.map((row) => row.issue.id));

  it('drops the answer of the workspace the user left', async () => {
    const slow = deferred<Array<LinearIssue>>();
    fetchAssigned.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([makeIssue({ id: 'b' })]);
    const { result, rerender } = renderHook(
      ({ workspaceId }: { readonly workspaceId: WorkspaceId }) => useLinearIssues(workspaceId),
      { initialProps: { workspaceId: WS_ONE } },
    );

    rerender({ workspaceId: WS_TWO });
    await waitFor(() => expect(idsOf(result.current.groups)).toEqual(['b']));
    await act(async () => {
      slow.resolve([makeIssue({ id: 'a' })]);
    });

    expect(idsOf(result.current.groups)).toEqual(['b']);
    expect(result.current.loading).toBe(false);
  });

  it('drops an answer that lands after the source was switched off', async () => {
    const slow = deferred<Array<LinearIssue>>();
    fetchAssigned.mockReturnValueOnce(slow.promise);
    const { result, rerender } = renderHook(
      ({ isEnabled }: { readonly isEnabled: boolean }) => useLinearIssues(WS_ONE, isEnabled),
      { initialProps: { isEnabled: true } },
    );

    rerender({ isEnabled: false });
    await act(async () => {
      slow.resolve([makeIssue({ id: 'a' })]);
    });

    expect(result.current.groups).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('drops the failure of a load that a newer one replaced', async () => {
    const slow = deferred<Array<LinearIssue>>();
    fetchAssigned.mockReturnValueOnce(slow.promise).mockResolvedValueOnce([makeIssue({ id: 'b' })]);
    const { result } = renderHook(() => useLinearIssues(WS_ONE));

    act(() => result.current.refetch());
    await waitFor(() => expect(idsOf(result.current.groups)).toEqual(['b']));
    await act(async () => {
      slow.reject(new Error('429 Too Many Requests'));
    });

    expect(result.current.error).toBeNull();
    expect(idsOf(result.current.groups)).toEqual(['b']);
  });
});
