import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listAllSessionWorktrees, scanOrphanWorktrees } = vi.hoisted(() => ({
  listAllSessionWorktrees: vi.fn(async () => [
    { worktreePath: '/repo/.goodboy/worktrees/gb-live' },
  ]),
  scanOrphanWorktrees: vi.fn(async () => [
    { path: '/repo/.goodboy/worktrees/gb-ghost', name: 'gb-ghost', sizeBytes: 4096 },
  ]),
}));

vi.mock('@goodboy/db', () => ({ listAllSessionWorktrees }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({ scanOrphanWorktrees }));

import { reconcileOrphanWorktrees } from './reconcileOrphanWorktrees';

const emitNotification = vi.fn(async () => undefined);

const makeStore = (kind: string) => ({
  workspaces: [{ id: 'ws-1', name: 'demo', rootPath: '/repo', kind }],
  orphanWorktrees: {},
  emitNotification,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconciling the worktrees folder at startup', () => {
  it('reports a folder git forgot, and never counts one a session still owns', async () => {
    const store = makeStore('repo');
    const set = vi.fn((updater: (s: unknown) => unknown) => {
      Object.assign(store, updater(store));
    });

    await reconcileOrphanWorktrees(set as never, (() => store) as never)();

    expect(scanOrphanWorktrees).toHaveBeenCalledWith({
      repoPath: '/repo',
      knownPaths: ['/repo/.goodboy/worktrees/gb-live'],
    });
    expect(store.orphanWorktrees).toEqual({
      'ws-1': [{ path: '/repo/.goodboy/worktrees/gb-ghost', name: 'gb-ghost', sizeBytes: 4096 }],
    });
  });

  it('offers the cleanup instead of running it', async () => {
    const store = makeStore('repo');
    const set = vi.fn((updater: (s: unknown) => unknown) => {
      Object.assign(store, updater(store));
    });

    await reconcileOrphanWorktrees(set as never, (() => store) as never)();

    expect(emitNotification).toHaveBeenCalledWith(
      'orphan-worktrees',
      'info',
      expect.stringContaining('1 session folders left on disk'),
      expect.any(String),
      { workspaceId: 'ws-1', action: { kind: 'open-orphan-worktrees', workspaceId: 'ws-1' } },
    );
  });

  it('leaves a folder-backed workspace alone', async () => {
    const store = makeStore('simple');
    const set = vi.fn();

    await reconcileOrphanWorktrees(set as never, (() => store) as never)();

    expect(scanOrphanWorktrees).not.toHaveBeenCalled();
  });
});
