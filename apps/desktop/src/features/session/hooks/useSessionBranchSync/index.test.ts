// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  reconcileSessionBranch: vi.fn(async () => undefined),
  lastTurnFinishedAt: null as string | null,
  worktreePath: '/sessions/one/api' as string | null,
  status: vi.fn(async () => ({ branch: 'ak/renamed-by-an-agent' })),
}));

vi.mock('../../../../store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ reconcileSessionBranch: h.reconcileSessionBranch }),
  useSessionLastTurnFinishedAt: () => h.lastTurnFinishedAt,
}));

vi.mock('../../../../store/slices/worktrees/resolveSessionRepo', () => ({
  resolveSessionRepo: () => (h.worktreePath == null ? null : { worktreePath: h.worktreePath }),
}));

vi.mock('../../../worktree/worktree', () => ({
  worktreeStatus: () => h.status(),
}));

vi.mock('../useIsBranchlessSession', () => ({
  useIsBranchlessSession: () => false,
}));

import { useSessionBranchSync } from './index';

const session = {
  id: 'session-1' as SessionId,
  workspaceId: 'workspace-1' as WorkspaceId,
} as unknown as Session;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.lastTurnFinishedAt = null;
  h.worktreePath = '/sessions/one/api';
});

describe('useSessionBranchSync', () => {
  it('reads the branch off disk once the session is on screen', async () => {
    renderHook(() => useSessionBranchSync({ session, isActive: true }));

    await waitFor(() =>
      expect(h.reconcileSessionBranch).toHaveBeenCalledWith(session.id, 'ak/renamed-by-an-agent'),
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
});
