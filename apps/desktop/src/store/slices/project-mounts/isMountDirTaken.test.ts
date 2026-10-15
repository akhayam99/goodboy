// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isMountDirTaken } from './isMountDirTaken';

const h = vi.hoisted(() => ({
  sessionDirExists: vi.fn(),
  inspectWorktree: vi.fn(),
}));

vi.mock('../../../features/worktree/worktree', () => ({
  sessionDirExists: h.sessionDirExists,
  inspectWorktree: h.inspectWorktree,
}));

const PARAMS = {
  repoPath: '/repos/ledger-core',
  parentDir: '/repos/ledger-core/.goodboy/worktrees',
  dirName: 'gb-7k2q9x',
};

beforeEach(() => {
  h.sessionDirExists.mockReset();
  h.inspectWorktree.mockReset();
});

describe('isMountDirTaken', () => {
  it('is free when no folder has that name', async () => {
    h.sessionDirExists.mockResolvedValue(false);

    expect(await isMountDirTaken(PARAMS)).toBe(false);
    expect(h.sessionDirExists).toHaveBeenCalledWith({
      path: '/repos/ledger-core/.goodboy/worktrees/gb-7k2q9x',
    });
    expect(h.inspectWorktree).not.toHaveBeenCalled();
  });

  it('is taken when a plain folder holds the name', async () => {
    h.sessionDirExists.mockResolvedValue(true);
    h.inspectWorktree.mockResolvedValue({ kind: 'foreign-directory' });

    expect(await isMountDirTaken(PARAMS)).toBe(true);
  });

  it('is free again when the folder is already a worktree of this repository', async () => {
    h.sessionDirExists.mockResolvedValue(true);
    h.inspectWorktree.mockResolvedValue({ kind: 'registered' });

    expect(await isMountDirTaken(PARAMS)).toBe(false);
  });

  it('reports a failed inspection instead of guessing', async () => {
    h.sessionDirExists.mockResolvedValue(true);
    h.inspectWorktree.mockRejectedValue(new Error('inspection failed'));

    await expect(isMountDirTaken(PARAMS)).rejects.toThrow('inspection failed');
  });

  it('reports a failed existence check instead of guessing', async () => {
    h.sessionDirExists.mockRejectedValue(new Error('no backend'));

    await expect(isMountDirTaken(PARAMS)).rejects.toThrow('no backend');
  });
});
