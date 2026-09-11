// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store, worktreeStatus } = vi.hoisted(() => ({
  worktreeStatus: vi.fn(),
  store: {
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    planConsumptions: {} as Record<string, ReadonlyArray<unknown>>,
    sessionGithub: {} as Record<string, unknown>,
    sessionResolveThreads: {} as Record<string, ReadonlyArray<unknown>>,
    mountGithub: {} as Record<string, unknown>,
    mountGitlabMr: {} as Record<string, unknown>,
    mountBitbucketPr: {} as Record<string, unknown>,
    sessionProjectMounts: {
      'session-1': [
        {
          mountId: 'mount-api',
          projectId: 'api',
          mountName: 'API',
          worktreePath: '/api',
          branch: 'feat',
        },
      ],
    } as Record<string, ReadonlyArray<Record<string, string>>>,
    projects: [
      { id: 'api', name: 'API', baseBranch: 'main', workspaceId: 'ws-1' },
    ] as ReadonlyArray<Record<string, string>>,
    sessionEvents: {} as Record<string, ReadonlyArray<unknown>>,
  },
}));

vi.mock('../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useSessionPlans: () => [],
  useSessionOpenQuestions: () => [],
}));

vi.mock('../../workflows/useAttachedWorkflowRuns', () => ({
  useAttachedWorkflowRuns: () => [],
}));

vi.mock('../../workflows/useWorkflowAdvanceStates', () => ({
  useWorkflowAdvanceStates: () => new Map(),
}));

vi.mock('../../worktree/worktree', () => ({ worktreeStatus }));

import { resetWorktreeStatusCache } from '../../session/hooks/useWorktreeStatuses/cache';
import { useSessionSuggestions } from '.';

const session = { id: 'session-1', workspaceId: 'ws-1' } as Session;

beforeEach(() => {
  store.sessionProjectMounts = {
    'session-1': [
      {
        mountId: 'mount-api',
        projectId: 'api',
        mountName: 'API',
        worktreePath: '/api',
        branch: 'feat',
      },
    ],
  };
  store.projects = [{ id: 'api', name: 'API', baseBranch: 'main', workspaceId: 'ws-1' }];
  store.mountGithub = {};
  store.mountGitlabMr = {};
  store.mountBitbucketPr = {};
  worktreeStatus.mockReset();
  worktreeStatus.mockResolvedValue({
    branch: 'feat',
    mainDistance: { kind: 'known', ahead: 0, behind: 4 },
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  });
});

afterEach(() => {
  resetWorktreeStatusCache();
  store.sessionEvents = {};
  store.sessionPhaseRuns = {};
});

const rebaseRequested = ({
  behind,
  agentId,
  branch = 'main',
  mountId,
}: {
  behind: number;
  agentId: string;
  branch?: string;
  mountId?: string;
}) => ({
  id: `ev-${agentId}`,
  sessionId: 'session-1',
  kind: 'rebase_requested',
  payload: {
    projectId: 'api',
    projectName: 'API',
    branch,
    behind,
    agentId,
    ...(mountId === undefined ? {} : { mountId }),
  },
  createdAt: '2026-09-04T09:11:00.000Z',
});

describe('useSessionSuggestions rebase consumption', () => {
  it('skips a merged mount while its unfinished sibling still produces a rebase', async () => {
    store.sessionProjectMounts = {
      'session-1': [
        {
          mountId: 'mount-api',
          projectId: 'api',
          mountName: 'API merged',
          worktreePath: '/api-merged',
          branch: 'feat-merged',
        },
        {
          mountId: 'mount-api-open',
          projectId: 'api',
          mountName: 'API open',
          worktreePath: '/api-open',
          branch: 'feat-open',
        },
      ],
    };
    store.mountGithub = {
      'mount-api': {
        pr: {
          number: 12,
          state: 'merged',
          title: 'Merged request',
          url: 'https://github.com/acme/api/pull/12',
          isDraft: false,
        },
      },
    };
    const view = renderHook(() => useSessionSuggestions({ session }));

    await waitFor(() => {
      const rebase = view.result.current.find((candidate) => candidate.kind === 'rebase-project');
      expect(rebase?.payload.targets.map((target) => target.mountId)).toEqual(['mount-api-open']);
    });
    expect(worktreeStatus).toHaveBeenCalledTimes(1);
    expect(worktreeStatus).toHaveBeenCalledWith({ worktreePath: '/api-open', baseBranch: 'main' });
  });

  it('hides the rebase after a request while the distance is unchanged', async () => {
    store.sessionEvents = { 'session-1': [rebaseRequested({ behind: 4, agentId: 'agent-1' })] };
    store.sessionPhaseRuns = { 'session-1': [{ id: 'agent-1', status: 'running' }] };
    const view = renderHook(() => useSessionSuggestions({ session }));

    await waitFor(() => expect(worktreeStatus).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(view.result.current.some((s) => s.kind === 'rebase-project')).toBe(false);
  });

  it('offers the rebase again when the agent failed', async () => {
    store.sessionEvents = { 'session-1': [rebaseRequested({ behind: 4, agentId: 'agent-1' })] };
    store.sessionPhaseRuns = { 'session-1': [{ id: 'agent-1', status: 'failed' }] };
    const view = renderHook(() => useSessionSuggestions({ session }));

    await waitFor(() =>
      expect(view.result.current.some((s) => s.kind === 'rebase-project')).toBe(true),
    );
  });

  it('offers the rebase again when the project now compares against another base', async () => {
    store.sessionEvents = {
      'session-1': [rebaseRequested({ behind: 4, agentId: 'agent-1', branch: 'develop' })],
    };
    store.sessionPhaseRuns = { 'session-1': [{ id: 'agent-1', status: 'running' }] };
    const view = renderHook(() => useSessionSuggestions({ session }));

    await waitFor(() =>
      expect(view.result.current.some((s) => s.kind === 'rebase-project')).toBe(true),
    );
  });

  it('offers the rebase again when the base branch moved past the request', async () => {
    store.sessionEvents = { 'session-1': [rebaseRequested({ behind: 2, agentId: 'agent-1' })] };
    store.sessionPhaseRuns = { 'session-1': [{ id: 'agent-1', status: 'completed' }] };
    const view = renderHook(() => useSessionSuggestions({ session }));

    await waitFor(() =>
      expect(view.result.current.some((s) => s.kind === 'rebase-project')).toBe(true),
    );
  });

  it('consumes only the mount named by a new rebase request', async () => {
    store.sessionProjectMounts = {
      'session-1': [
        {
          mountId: 'mount-api',
          projectId: 'api',
          mountName: 'API first',
          worktreePath: '/api-first',
          branch: 'feat-first',
        },
        {
          mountId: 'mount-api-second',
          projectId: 'api',
          mountName: 'API second',
          worktreePath: '/api-second',
          branch: 'feat-second',
        },
      ],
    };
    store.sessionEvents = {
      'session-1': [rebaseRequested({ behind: 4, agentId: 'agent-1', mountId: 'mount-api' })],
    };
    store.sessionPhaseRuns = { 'session-1': [{ id: 'agent-1', status: 'running' }] };
    const view = renderHook(() => useSessionSuggestions({ session }));

    await waitFor(() => expect(worktreeStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      const rebase = view.result.current.find((candidate) => candidate.kind === 'rebase-project');
      expect(rebase?.payload.targets.map((target) => target.mountId)).toEqual(['mount-api-second']);
    });
  });
});

describe('useSessionSuggestions rebase opt-out', () => {
  it('reads the worktree and offers the rebase by default', async () => {
    const view = renderHook(() => useSessionSuggestions({ session }));

    await waitFor(() =>
      expect(view.result.current.some((s) => s.kind === 'rebase-project')).toBe(true),
    );
    expect(worktreeStatus).toHaveBeenCalledTimes(1);
  });

  it('collapses two mounts of the same project into one suggestion', async () => {
    store.sessionProjectMounts = {
      'session-1': [
        {
          mountId: 'mount-api',
          projectId: 'api',
          mountName: 'API first',
          worktreePath: '/api-first',
          branch: 'feat-first',
        },
        {
          mountId: 'mount-api-second',
          projectId: 'api',
          mountName: 'API second',
          worktreePath: '/api-second',
          branch: 'feat-second',
        },
      ],
    };
    const view = renderHook(() => useSessionSuggestions({ session }));

    await waitFor(() => expect(worktreeStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      const rebases = view.result.current.filter(
        (suggestion) => suggestion.kind === 'rebase-project',
      );
      expect(rebases).toHaveLength(1);
      expect(rebases[0]?.payload.targets).toHaveLength(2);
    });
  });

  it('runs no git work and offers no rebase when the caller opts out', async () => {
    const view = renderHook(() => useSessionSuggestions({ session, withRebase: false }));

    await waitFor(() => expect(view.result.current).toBeDefined());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(worktreeStatus).not.toHaveBeenCalled();
    expect(view.result.current.some((s) => s.kind === 'rebase-project')).toBe(false);
  });
});
