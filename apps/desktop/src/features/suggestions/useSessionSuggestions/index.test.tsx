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
    sessionPendingResolutions: {} as Record<string, ReadonlyArray<unknown>>,
    sessionProjectMounts: {
      'session-1': [{ projectId: 'api', mountName: 'API', worktreePath: '/api', branch: 'feat' }],
    } as Record<string, ReadonlyArray<Record<string, string>>>,
    projects: [
      { id: 'api', name: 'API', baseBranch: 'main', workspaceId: 'ws-1' },
    ] as ReadonlyArray<Record<string, string>>,
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

vi.mock('../../session/hooks/useResolverIndex', () => ({
  useResolverIndex: () => ({
    links: [],
    byThreadId: new Map(),
    byCommentUrl: new Map(),
    byDiffAgentId: new Map(),
  }),
}));

vi.mock('../../worktree/worktree', () => ({ worktreeStatus }));

import { resetWorktreeStatusCache } from '../../session/hooks/useWorktreeStatuses/cache';
import { useSessionSuggestions } from '.';

const session = { id: 'session-1', workspaceId: 'ws-1' } as Session;

beforeEach(() => {
  worktreeStatus.mockReset();
  worktreeStatus.mockResolvedValue({
    branch: 'feat',
    mainDistance: { kind: 'known', ahead: 0, behind: 4 },
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  });
});

afterEach(() => {
  resetWorktreeStatusCache();
});

describe('useSessionSuggestions rebase opt-out', () => {
  it('reads the worktree and offers the rebase by default', async () => {
    const view = renderHook(() => useSessionSuggestions({ session }));

    await waitFor(() =>
      expect(view.result.current.some((s) => s.kind === 'rebase-project')).toBe(true),
    );
    expect(worktreeStatus).toHaveBeenCalledTimes(1);
  });

  it('runs no git work and offers no rebase when the caller opts out', async () => {
    const view = renderHook(() => useSessionSuggestions({ session, withRebase: false }));

    await waitFor(() => expect(view.result.current).toBeDefined());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(worktreeStatus).not.toHaveBeenCalled();
    expect(view.result.current.some((s) => s.kind === 'rebase-project')).toBe(false);
  });
});
