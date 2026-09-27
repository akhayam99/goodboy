// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';

const { showToast, state } = vi.hoisted(() => ({
  showToast: vi.fn(),
  state: {
    historyRuns: {} as Record<string, unknown>,
    sessionProjectMounts: {
      'session-1': [{ mountId: 'mount-1', projectId: 'project-1', baseBranch: 'main' }],
    } as Record<string, ReadonlyArray<unknown>>,
    projects: [{ id: 'project-1', baseBranch: 'main' }],
    rebaseBranch: vi.fn(async () => 'rebased'),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

import { useRebaseBranch } from './index';

const sessionId = 'session-1' as SessionId;
const mountId = 'mount-1' as MountId;

const behindBy = (behind: number): WorktreeStatus =>
  ({
    mainDistance: { kind: 'known', ahead: 2, behind },
  }) as unknown as WorktreeStatus;

afterEach(() => {
  cleanup();
  state.historyRuns = {};
  state.rebaseBranch.mockClear();
  showToast.mockClear();
});

describe('useRebaseBranch', () => {
  it('rebases with the engine and says the backup stays', async () => {
    const { result } = renderHook(() =>
      useRebaseBranch({ sessionId, mountId, status: behindBy(4) }),
    );

    await act(async () => {
      await result.current.run({ mountId });
    });

    expect(state.rebaseBranch).toHaveBeenCalledWith({ sessionId, mountId });
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: 'Rebase done' }),
    );
  });

  it('does nothing when the branch is not behind', async () => {
    const { result } = renderHook(() =>
      useRebaseBranch({ sessionId, mountId, status: behindBy(0) }),
    );

    await act(async () => {
      await result.current.run({ mountId });
    });

    expect(result.current.canRebase).toBe(false);
    expect(state.rebaseBranch).not.toHaveBeenCalled();
  });

  it('reads a running rewrite and a stopped rebase from the history run', () => {
    state.historyRuns = {
      [mountId]: { origin: 'rebase', phase: 'rewriting', agentId: 'agent-7', stop: null },
    };
    const running = renderHook(() => useRebaseBranch({ sessionId, mountId, status: behindBy(4) }));
    expect(running.result.current.isRunning).toBe(true);
    expect(running.result.current.rewriterId).toBe('agent-7');
    running.unmount();

    state.historyRuns = {
      [mountId]: {
        origin: 'rebase',
        phase: 'stopped',
        agentId: null,
        stop: { reason: 'origin-moved', message: 'Origin moved since the rewrite.' },
      },
    };
    const stopped = renderHook(() => useRebaseBranch({ sessionId, mountId, status: behindBy(4) }));
    expect(stopped.result.current.isRunning).toBe(false);
    expect(stopped.result.current.error).toBe('Origin moved since the rewrite.');
  });
});
