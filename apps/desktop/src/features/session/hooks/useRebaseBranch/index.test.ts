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
    projects: [{ id: 'project-1', baseBranch: 'main' as string | null }],
    rebaseBranch: vi.fn(async (): Promise<string> => 'rebased'),
    reportError: vi.fn(async (_params: unknown) => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../../shared/components/Toast', () => ({
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
  state.reportError.mockClear();
  showToast.mockClear();
});

describe('useRebaseBranch base branch', () => {
  const rebaseMessage = async () => {
    const { result } = renderHook(() =>
      useRebaseBranch({ sessionId, mountId, status: behindBy(4) }),
    );
    await act(async () => {
      await result.current.run({ mountId });
    });
    return (showToast.mock.calls[0]?.[0] as { readonly message: string }).message;
  };

  const seed = ({
    mountBase,
    projectBase,
  }: {
    readonly mountBase: string | null;
    readonly projectBase: string | null;
  }) => {
    state.sessionProjectMounts = {
      'session-1': [{ mountId: 'mount-1', projectId: 'project-1', baseBranch: mountBase }],
    };
    state.projects = [{ id: 'project-1', baseBranch: projectBase }];
  };

  afterEach(() => {
    seed({ mountBase: 'main', projectBase: 'main' });
  });

  it('names the mount base in the done toast', async () => {
    seed({ mountBase: 'develop', projectBase: 'main' });

    expect(await rebaseMessage()).toContain('rebased on develop.');
  });

  it('names the project base when the mount has none', async () => {
    seed({ mountBase: null, projectBase: 'develop' });

    expect(await rebaseMessage()).toContain('rebased on develop.');
  });

  it('never says main when no base is known', async () => {
    seed({ mountBase: null, projectBase: null });

    expect(await rebaseMessage()).toContain('rebased on its base branch.');
  });
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

  it('logs a rebase that throws before the engine can stop it', async () => {
    state.rebaseBranch.mockRejectedValueOnce(new Error('no mount for this session'));
    const { result } = renderHook(() =>
      useRebaseBranch({ sessionId, mountId, status: behindBy(4) }),
    );

    await act(async () => {
      await result.current.run({ mountId });
    });

    expect(state.reportError).toHaveBeenCalledWith({
      title: "Couldn't rebase the branch",
      error: new Error('no mount for this session'),
      sessionId,
    });
    expect(result.current.isRunning).toBe(false);
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

  it('reads a running rewrite and a stopped rebase from the history run, and keeps the stop text out', () => {
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
    expect(stopped.result.current.rewriterId).toBeNull();
  });
});
