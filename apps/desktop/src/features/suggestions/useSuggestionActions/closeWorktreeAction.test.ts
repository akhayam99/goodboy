// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { closeWorktreeAction } from './closeWorktreeAction';

const sessionId = brandId<SessionId>({ value: 'session-harborline' });
const mountId = brandId<MountId>({ value: 'mount-ledger-core' });

const worktree = {
  mountId,
  requestId: 'cleanup:merge_cleanup:mount-ledger-core:feature/rounding',
  branch: 'feature/rounding',
  prNumber: 418,
};

type Setup = {
  readonly isProposed: boolean;
  readonly kind?: string;
};

const setup = ({ isProposed, kind = 'removed' }: Setup) => {
  const resolveCleanup = vi.fn(async (_params: unknown) => undefined);
  const removeWorktree = vi.fn(async (_params: unknown) => ({
    kind,
    reason: kind === 'removed' ? null : 'a terminal is open in the worktree',
  }));
  const action = closeWorktreeAction({
    sessionId,
    worktrees: [worktree],
    isProposed: () => isProposed,
    resolveCleanup,
    removeWorktree,
  });
  return { action, resolveCleanup, removeWorktree };
};

describe('closeWorktreeAction', () => {
  it('resolves the saved proposal when one exists', async () => {
    const { action, resolveCleanup, removeWorktree } = setup({ isProposed: true });
    await action?.run();
    expect(resolveCleanup).toHaveBeenCalledWith({
      sessionId,
      requestId: worktree.requestId,
      decision: 'remove',
    });
    expect(removeWorktree).not.toHaveBeenCalled();
  });

  it('removes a merged or idle worktree safely when no proposal was saved yet', async () => {
    const { action, resolveCleanup, removeWorktree } = setup({ isProposed: false });
    await action?.run();
    expect(removeWorktree).toHaveBeenCalledWith({ sessionId, mountId, mode: 'safe' });
    expect(resolveCleanup).not.toHaveBeenCalled();
  });

  it('fails with the reason when the worktree stays, and Retry tries again', async () => {
    const { action, removeWorktree } = setup({ isProposed: false, kind: 'kept' });
    await expect(action?.run()).rejects.toThrow('a terminal is open in the worktree');
    await expect(action?.run()).rejects.toThrow('a terminal is open in the worktree');
    expect(removeWorktree).toHaveBeenCalledTimes(2);
  });
});

describe('closeWorktreeAction for a row with several worktrees', () => {
  const second = {
    ...worktree,
    requestId: 'cleanup:merge_cleanup:mount-ledger-core:feature/api',
    branch: 'feature/api',
  };

  it('says Remove worktrees, asks to confirm and removes each one in order', async () => {
    const resolveCleanup = vi.fn(async (_params: unknown) => undefined);
    const action = closeWorktreeAction({
      sessionId,
      worktrees: [worktree, second],
      isProposed: () => true,
      resolveCleanup,
      removeWorktree: vi.fn(async (_params: unknown) => ({ kind: 'removed' })),
    });
    expect(action?.label).toBe('Remove worktrees');
    expect(action?.shortLabel).toBe('Remove');
    expect(action?.requiresConfirm).toBe(true);
    await action?.run();
    expect(resolveCleanup).toHaveBeenNthCalledWith(1, {
      sessionId,
      requestId: worktree.requestId,
      decision: 'remove',
    });
    expect(resolveCleanup).toHaveBeenNthCalledWith(2, {
      sessionId,
      requestId: second.requestId,
      decision: 'remove',
    });
  });
});
