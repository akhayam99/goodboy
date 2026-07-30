// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorktreeStatus } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessions: [
      {
        id: 'session-1',
        workspaceId: 'workspace-1',
        providerPreference: { defaultProvider: 'anthropic' },
      },
    ],
    workspaceOverrides: {
      'workspace-1': {
        taskModels: {
          rebase: { providerId: 'codex', model: 'gpt-5.4' },
        },
      },
    },
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<{ name: string; status: string }>>,
    spawnAgent: vi.fn(async () => 'agent-1'),
    selectAgent: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../components/AgentSpawnConfig/taskModelAgentSpawnConfig', () => ({
  taskModelAgentSpawnConfig: () => ({
    provider: 'codex',
    model: 'gpt-5.4',
    effort: 'low',
  }),
}));

import { useRebaseAgent } from './index';

const sessionId = 'session-1' as SessionId;

const status = (commitsBehindMain: number): WorktreeStatus =>
  ({
    commitsBehindMain,
  }) as WorktreeStatus;

beforeEach(() => {
  state.sessionPhaseRuns = {};
  state.spawnAgent.mockReset();
  state.spawnAgent.mockResolvedValue('agent-1');
  state.selectAgent.mockReset();
  state.selectAgent.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('useRebaseAgent', () => {
  it('allows rebase only when the branch is behind main', () => {
    const { result, rerender } = renderHook(
      ({ worktreeStatus }) => useRebaseAgent({ sessionId, status: worktreeStatus }),
      { initialProps: { worktreeStatus: status(0) } },
    );

    expect(result.current.canRebase).toBe(false);
    rerender({ worktreeStatus: status(2) });
    expect(result.current.canRebase).toBe(true);
  });

  it('spawns and selects the rebase agent with the resolved task model', async () => {
    const { result } = renderHook(() => useRebaseAgent({ sessionId, status: status(2) }));

    await act(() => result.current.run());

    expect(state.spawnAgent).toHaveBeenCalledWith(
      sessionId,
      expect.objectContaining({
        name: 'Rebase on main',
        initialPrompt: expect.stringContaining('Rebase this session branch onto origin/main.'),
        provider: 'codex',
        model: 'gpt-5.4',
        effort: 'low',
      }),
    );
    expect(state.selectAgent).toHaveBeenCalledWith(sessionId, 'agent-1');
  });

  it('reports spawn failures', async () => {
    state.spawnAgent.mockRejectedValueOnce(new Error('agent launch failed'));
    const { result } = renderHook(() => useRebaseAgent({ sessionId, status: status(2) }));

    await act(() => result.current.run());

    expect(result.current.error).toBe('agent launch failed');
  });

  it('guards against a second rebase while the named agent is running', async () => {
    state.sessionPhaseRuns = {
      [sessionId]: [{ name: 'Rebase on main', status: 'running' }],
    };
    const { result } = renderHook(() => useRebaseAgent({ sessionId, status: status(2) }));

    expect(result.current.isRunning).toBe(true);
    await act(() => result.current.run());
    await waitFor(() => expect(state.spawnAgent).not.toHaveBeenCalled());
  });
});
