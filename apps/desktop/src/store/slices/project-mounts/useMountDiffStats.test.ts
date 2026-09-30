import { act, renderHook, waitFor } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, AgentId, SessionId } from '@goodboy/types';

type StoreState = Record<string, unknown>;

const { store, changedFiles } = vi.hoisted(() => {
  const store: { state: StoreState } = { state: {} };
  return { store, changedFiles: vi.fn() };
});

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(store.state),
}));

vi.mock('../../../features/worktree/worktree', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../features/worktree/worktree')>()),
  worktreeChangedFiles: changedFiles,
}));

import { useMountDiffStats } from './useMountDiffStats';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

beforeEach(() => {
  store.state = {
    sessionPhaseRuns: {},
    selectedAgentId: {},
    currentSessionId: null,
    agentKindOverride: {},
    terminalTabs: {},
    terminalSessions: {},
    sessionGithub: {},
    sessionGitlabMr: {},
    sessionOpenQuestions: {},
    sessionViewPrefs: {},
    getSessionViewPrefs: vi.fn(),
    selectedProjectIds: {},
    getSelectedProjectIds: vi.fn(),
    sessions: [],
    workspaces: [],
    projects: [],
    sessionBranches: {},
    sessionWorktrees: {},
    sessionWorktreeRecords: {},
    summarizerStatus: {},
    sessionProjectMounts: {},
    sessionActiveProject: {},
    githubStatus: null,
  };
  changedFiles.mockReset();
});

describe('useMountDiffStats', () => {
  const worktreeRow = ({
    id,
    worktreePath,
  }: {
    readonly id: string;
    readonly worktreePath: string;
  }) => ({ id, sessionId: SESSION_ID, worktreePath, branch: 'ak/feat', parallelIndex: 0 });

  it('fetches nothing for a session with no worktrees', () => {
    const { result } = renderHook(() => useMountDiffStats(SESSION_ID));

    expect(result.current.size).toBe(0);
    expect(changedFiles).not.toHaveBeenCalled();
  });

  it('keys one stat per worktree path', async () => {
    store.state.sessionWorktreeRecords = {
      [SESSION_ID]: [
        worktreeRow({ id: 'wt-1', worktreePath: '/tmp/a' }),
        worktreeRow({ id: 'wt-2', worktreePath: '/tmp/b' }),
      ],
    };
    changedFiles.mockImplementation(({ worktreePath: path }: { worktreePath: string }) =>
      Promise.resolve(
        path === '/tmp/a'
          ? { paths: ['x.ts'], additions: 2000, deletions: 200, numstat: '' }
          : { paths: [], additions: 0, deletions: 0, numstat: '' },
      ),
    );

    const { result } = renderHook(() => useMountDiffStats(SESSION_ID));

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get('/tmp/a')).toEqual({ additions: 2000, deletions: 200 });
    expect(result.current.get('/tmp/b')).toEqual({ additions: 0, deletions: 0 });
  });

  it('swallows one failing path to zero instead of losing the whole map', async () => {
    store.state.sessionWorktreeRecords = {
      [SESSION_ID]: [
        worktreeRow({ id: 'wt-1', worktreePath: '/tmp/a' }),
        worktreeRow({ id: 'wt-2', worktreePath: '/tmp/gone' }),
      ],
    };
    changedFiles.mockImplementation(({ worktreePath: path }: { worktreePath: string }) =>
      path === '/tmp/gone'
        ? Promise.reject(new Error('not a worktree'))
        : Promise.resolve({ paths: ['x.ts'], additions: 3, deletions: 1, numstat: '' }),
    );

    const { result } = renderHook(() => useMountDiffStats(SESSION_ID));

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get('/tmp/a')).toEqual({ additions: 3, deletions: 1 });
    expect(result.current.get('/tmp/gone')).toEqual({ additions: 0, deletions: 0 });
  });

  it('skips a worktree row that carries no path', async () => {
    store.state.sessionWorktreeRecords = {
      [SESSION_ID]: [
        worktreeRow({ id: 'wt-1', worktreePath: '' }),
        worktreeRow({ id: 'wt-2', worktreePath: '/tmp/b' }),
      ],
    };
    changedFiles.mockResolvedValue({ paths: [], additions: 0, deletions: 0, numstat: '' });

    const { result } = renderHook(() => useMountDiffStats(SESSION_ID));

    await waitFor(() => expect(result.current.size).toBe(1));
    expect(changedFiles).toHaveBeenCalledTimes(1);
    expect(changedFiles).toHaveBeenCalledWith({ worktreePath: '/tmp/b', baseBranch: null });
  });

  it('counts against the base branch the mount or its project picked', async () => {
    store.state.projects = [{ id: 'project-1', baseBranch: 'develop' }];
    store.state.sessionProjectMounts = {
      [SESSION_ID]: [
        { projectId: 'project-1', worktreePath: '/tmp/a', baseBranch: null },
        { projectId: 'project-1', worktreePath: '/tmp/b', baseBranch: 'release/9' },
        { projectId: 'project-2', worktreePath: '/tmp/c', baseBranch: null },
      ],
    };
    store.state.sessionWorktreeRecords = {
      [SESSION_ID]: [
        worktreeRow({ id: 'wt-1', worktreePath: '/tmp/a' }),
        worktreeRow({ id: 'wt-2', worktreePath: '/tmp/b' }),
        worktreeRow({ id: 'wt-3', worktreePath: '/tmp/c' }),
      ],
    };
    changedFiles.mockResolvedValue({ paths: [], additions: 1, deletions: 0, numstat: '' });

    const { result } = renderHook(() => useMountDiffStats(SESSION_ID));

    await waitFor(() => expect(result.current.size).toBe(3));
    expect(changedFiles).toHaveBeenCalledWith({ worktreePath: '/tmp/a', baseBranch: 'develop' });
    expect(changedFiles).toHaveBeenCalledWith({ worktreePath: '/tmp/b', baseBranch: 'release/9' });
    expect(changedFiles).toHaveBeenCalledWith({ worktreePath: '/tmp/c', baseBranch: null });
  });

  it('refetches when the last turn finishes', async () => {
    store.state.sessionWorktreeRecords = {
      [SESSION_ID]: [worktreeRow({ id: 'wt-1', worktreePath: '/tmp/a' })],
    };
    changedFiles.mockResolvedValue({ paths: [], additions: 1, deletions: 0, numstat: '' });

    const { rerender } = renderHook(() => useMountDiffStats(SESSION_ID));
    await waitFor(() => expect(changedFiles).toHaveBeenCalledTimes(1));

    store.state.sessionPhaseRuns = {
      [SESSION_ID]: [
        anAgent({
          id: AGENT_ID,
          sessionId: SESSION_ID,
          lastFinishedAt: '2026-08-22T10:00:00.000Z' as IsoDateTime,
        }),
      ],
    };
    rerender();

    await waitFor(() => expect(changedFiles).toHaveBeenCalledTimes(2));
  });

  it('asks git once when several surfaces read the same mount at the same time', async () => {
    store.state.sessionWorktreeRecords = {
      [SESSION_ID]: [worktreeRow({ id: 'wt-1', worktreePath: '/tmp/a' })],
    };
    changedFiles.mockResolvedValue({ paths: [], additions: 4, deletions: 0, numstat: '' });

    const { result } = renderHook(() => [
      useMountDiffStats(SESSION_ID),
      useMountDiffStats(SESSION_ID),
      useMountDiffStats(SESSION_ID),
    ]);

    await waitFor(() => expect(result.current[0]?.get('/tmp/a')).toBeDefined());
    expect(result.current[2]?.get('/tmp/a')).toEqual({ additions: 4, deletions: 0 });
    expect(changedFiles).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the window comes back into view', async () => {
    store.state.sessionWorktreeRecords = {
      [SESSION_ID]: [worktreeRow({ id: 'wt-1', worktreePath: '/tmp/a' })],
    };
    changedFiles.mockResolvedValue({ paths: [], additions: 1, deletions: 0, numstat: '' });

    renderHook(() => useMountDiffStats(SESSION_ID));
    await waitFor(() => expect(changedFiles).toHaveBeenCalledTimes(1));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(changedFiles).toHaveBeenCalledTimes(2));
  });

  it('returns an empty map without a session', () => {
    const { result } = renderHook(() => useMountDiffStats(null));

    expect(result.current.size).toBe(0);
    expect(changedFiles).not.toHaveBeenCalled();
  });
});
