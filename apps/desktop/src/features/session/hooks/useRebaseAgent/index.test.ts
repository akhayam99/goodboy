// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorktreeStatus } from '@goodboy/types';

type ToastAction = { readonly label: string; readonly onClick: () => void };

type ToastOptions = { readonly title?: string; readonly action?: ToastAction };

const { showToast, state } = vi.hoisted(() => ({
  showToast: vi.fn<(kind: string, message: string, opts?: ToastOptions) => void>(),
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
    sessionPhaseRuns: {} as Record<
      string,
      ReadonlyArray<{ id: string; name: string; status: string }>
    >,
    spawnAgent: vi.fn(async () => 'agent-1'),
    selectAgent: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    beginSessionCreation: vi.fn(() => 'creation-1'),
    endSessionCreation: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
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
    mainDistance: { kind: 'known', ahead: 0, behind: commitsBehindMain },
  }) as WorktreeStatus;

beforeEach(() => {
  state.sessionPhaseRuns = {};
  state.spawnAgent.mockReset();
  state.spawnAgent.mockResolvedValue('agent-1');
  state.selectAgent.mockReset();
  state.selectAgent.mockResolvedValue(undefined);
  state.setActiveLens.mockReset();
  state.beginSessionCreation.mockReset();
  state.beginSessionCreation.mockReturnValue('creation-1');
  state.endSessionCreation.mockReset();
  showToast.mockClear();
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

  it('spawns the rebase agent with the resolved task model without selecting it', async () => {
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
    expect(state.selectAgent).not.toHaveBeenCalled();
  });

  it('spawns without taking the focus and marks the branch action in flight', async () => {
    const { result } = renderHook(() => useRebaseAgent({ sessionId, status: status(2) }));

    await act(() => result.current.run());

    expect(state.spawnAgent).toHaveBeenCalledWith(
      sessionId,
      expect.objectContaining({ focus: 'none' }),
    );
    expect(state.beginSessionCreation).toHaveBeenCalledWith(sessionId, {
      kind: 'branch',
      label: 'Rebasing on main',
    });
    expect(showToast.mock.calls[0]?.[2]?.title).toBe('Rebase started');
  });

  it('offers an action that opens the agent once the rebase settles', async () => {
    const { result, rerender } = renderHook(() => useRebaseAgent({ sessionId, status: status(2) }));

    await act(() => result.current.run());
    state.sessionPhaseRuns = {
      [sessionId]: [{ id: 'agent-1', name: 'Rebase on main', status: 'failed' }],
    };
    rerender();

    await waitFor(() => expect(showToast).toHaveBeenCalledTimes(2));
    expect(state.endSessionCreation).toHaveBeenCalledWith(sessionId, 'creation-1');
    const action = showToast.mock.calls[1]?.[2]?.action;
    expect(action?.label).toBe('Open the rebase agent');
    expect(state.selectAgent).not.toHaveBeenCalled();

    action?.onClick();

    expect(state.selectAgent).toHaveBeenCalledWith(sessionId, 'agent-1');
    expect(state.setActiveLens).toHaveBeenCalledWith(sessionId, 'agents');
  });

  it('reports spawn failures', async () => {
    state.spawnAgent.mockRejectedValueOnce(new Error('agent launch failed'));
    const { result } = renderHook(() => useRebaseAgent({ sessionId, status: status(2) }));

    await act(() => result.current.run());

    expect(result.current.error).toBe('agent launch failed');
    expect(state.endSessionCreation).toHaveBeenCalledWith(sessionId, 'creation-1');
  });

  it('guards against a second rebase while the named agent is running', async () => {
    state.sessionPhaseRuns = {
      [sessionId]: [{ id: 'agent-9', name: 'Rebase on main', status: 'running' }],
    };
    const { result } = renderHook(() => useRebaseAgent({ sessionId, status: status(2) }));

    expect(result.current.isRunning).toBe(true);
    await act(() => result.current.run());
    await waitFor(() => expect(state.spawnAgent).not.toHaveBeenCalled());
  });
});
