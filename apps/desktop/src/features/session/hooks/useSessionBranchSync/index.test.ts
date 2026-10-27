// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  reconcileSessionBranch: vi.fn(async () => undefined),
  reportError: vi.fn(async () => undefined),
  invokeCommand: vi.fn(async (..._args: Array<unknown>): Promise<unknown> => ({ onlyOnline: [] })),
  lastTurnFinishedAt: null as string | null,
  worktreePath: '/sessions/one/api' as string | null,
  status: vi.fn(async (): Promise<unknown> => ({ branch: 'ak/renamed-by-an-agent' })),
}));

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      reconcileSessionBranch: h.reconcileSessionBranch,
      reportError: h.reportError,
    }),
  useSessionLastTurnFinishedAt: () => h.lastTurnFinishedAt,
}));

vi.mock('../../../../store/slices/worktrees/resolveSessionRepo', () => ({
  resolveSessionRepo: () =>
    h.worktreePath === null ? null : { worktreePath: h.worktreePath, mountId: 'mount-1' },
}));

vi.mock('../../../worktree/worktree', () => ({
  worktreeStatus: () => h.status(),
}));

vi.mock('../../../../shared/lib/invokeCommand', () => ({
  invokeCommand: (...args: Array<unknown>) => h.invokeCommand(...args),
}));

vi.mock('../useIsBranchlessSession', () => ({
  useIsBranchlessSession: () => false,
}));

import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { useSessionBranchSync } from './index';

const session = {
  id: 'session-1' as SessionId,
  workspaceId: 'workspace-1' as WorkspaceId,
} as unknown as Session;

afterEach(() => {
  cleanup();
  resetWorktreeStatusCache();
  vi.clearAllMocks();
  h.lastTurnFinishedAt = null;
  h.worktreePath = '/sessions/one/api';
});

describe('useSessionBranchSync', () => {
  it('reads the branch off disk once the session is on screen', async () => {
    renderHook(() => useSessionBranchSync({ session, isActive: true }));

    await waitFor(() =>
      expect(h.reconcileSessionBranch).toHaveBeenCalledWith({
        sessionId: session.id,
        mountId: 'mount-1',
        worktreePath: '/sessions/one/api',
        observedBranch: 'ak/renamed-by-an-agent',
      }),
    );
  });

  it('reads it again when a turn ends, even though no file changed', async () => {
    const { rerender } = renderHook(() => useSessionBranchSync({ session, isActive: true }));
    await waitFor(() => expect(h.status).toHaveBeenCalledTimes(1));

    h.lastTurnFinishedAt = '2026-08-27T10:00:00.000Z';
    rerender();

    await waitFor(() => expect(h.status).toHaveBeenCalledTimes(2));
  });

  it('leaves a session alone while it is off screen', () => {
    renderHook(() => useSessionBranchSync({ session, isActive: false }));

    expect(h.status).not.toHaveBeenCalled();
  });

  it('reads the online copy when the branch differs from it', async () => {
    h.status.mockResolvedValueOnce({
      branch: 'ak/renamed-by-an-agent',
      upstreamDistance: { kind: 'known', ahead: 2, behind: 1 },
    });

    renderHook(() => useSessionBranchSync({ session, isActive: true }));

    await waitFor(() =>
      expect(h.invokeCommand).toHaveBeenCalledWith(
        'history_origin_ahead',
        expect.objectContaining({
          worktreePath: '/sessions/one/api',
          branch: 'ak/renamed-by-an-agent',
        }),
      ),
    );
  });

  it('leaves the online copy unread while the branch is level with it', async () => {
    h.status.mockResolvedValueOnce({
      branch: 'ak/renamed-by-an-agent',
      upstreamDistance: { kind: 'known', ahead: 2, behind: 0 },
    });

    renderHook(() => useSessionBranchSync({ session, isActive: true }));
    await waitFor(() => expect(h.reconcileSessionBranch).toHaveBeenCalled());

    expect(h.invokeCommand).not.toHaveBeenCalled();
  });

  it('tells the user when the online copy could not be read', async () => {
    h.status.mockResolvedValueOnce({
      branch: 'ak/renamed-by-an-agent',
      upstreamDistance: { kind: 'known', ahead: 2, behind: 1 },
    });
    h.invokeCommand.mockRejectedValueOnce(new Error('offline'));

    renderHook(() => useSessionBranchSync({ session, isActive: true }));

    await waitFor(() =>
      expect(h.reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't check the online copy", severity: 'warning' }),
      ),
    );
  });
});
