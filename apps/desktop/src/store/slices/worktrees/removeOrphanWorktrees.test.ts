import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorktreeRemovalResult } from '@goodboy/types';

const { deleteRetainedWorktreePath, removeWorktreeFolder } = vi.hoisted(() => ({
  deleteRetainedWorktreePath: vi.fn(async () => undefined),
  removeWorktreeFolder: vi.fn(
    async ({ path }: { readonly path: string }): Promise<WorktreeRemovalResult> => ({
      kind: 'removed',
      path,
    }),
  ),
}));

vi.mock('@goodboy/db', () => ({ deleteRetainedWorktreePath }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({ removeWorktreeFolder }));

import { removeOrphanWorktrees } from './removeOrphanWorktrees';

const GHOST = '/repo/.goodboy/worktrees/gb-ghost';
const DIRTY = '/repo/.goodboy/worktrees/gb-dirty';
const STRAY = '/other/.goodboy/worktrees/gb-stray';

const orphan = (path: string) => ({
  path,
  name: path.split('/').at(-1) ?? path,
  sizeBytes: 4096,
  isRegistered: false,
});

const makeStore = () => ({
  projects: [
    { id: 'project-1', workspaceId: 'ws-1', name: 'ledger-core', rootPath: '/repo', kind: 'repo' },
  ],
  orphanWorktrees: { 'ws-1': [orphan(GHOST), orphan(DIRTY), orphan(STRAY)] },
  retainedWorktreePaths: {
    'ws-1': [
      { id: 'retained-ghost', worktreePath: GHOST },
      { id: 'retained-dirty', worktreePath: DIRTY },
    ],
  },
});

type Store = ReturnType<typeof makeStore>;

const run = async (
  store: Store,
  paths: ReadonlyArray<string>,
  mode: 'safe' | 'confirmed' = 'safe',
) => {
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === 'function' ? (updater as (s: Store) => object)(store) : updater;
    Object.assign(store, patch);
  });
  const get = (() => store) as never;
  return removeOrphanWorktrees(set as never, get)({ workspaceId: 'ws-1' as never, paths, mode });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('removing orphan worktrees', () => {
  it('reports each folder with its outcome and drops only the removed ones', async () => {
    removeWorktreeFolder.mockImplementation(async ({ path }) =>
      path === DIRTY
        ? { kind: 'kept', path, reasons: ['unstaged-changes'] }
        : { kind: 'removed', path },
    );
    const store = makeStore();

    const outcomes = await run(store, [GHOST, DIRTY, STRAY]);

    expect(outcomes).toEqual([
      { kind: 'removed', path: GHOST },
      { kind: 'kept', path: DIRTY, reasons: ['unstaged-changes'] },
      { kind: 'failed', path: STRAY, message: `no repository owns ${STRAY}` },
    ]);
    expect(removeWorktreeFolder).toHaveBeenCalledTimes(2);
    expect(removeWorktreeFolder).toHaveBeenCalledWith({
      repoPath: '/repo',
      path: GHOST,
      mode: 'safe',
    });
    expect(store.orphanWorktrees['ws-1'].map((entry) => entry.path)).toEqual([DIRTY, STRAY]);
    expect(deleteRetainedWorktreePath).toHaveBeenCalledTimes(1);
    expect(deleteRetainedWorktreePath).toHaveBeenCalledWith({ db: {}, id: 'retained-ghost' });
    expect(store.retainedWorktreePaths['ws-1']).toEqual([
      { id: 'retained-dirty', worktreePath: DIRTY },
    ]);
  });

  it('passes a confirmed force through to the folder removal', async () => {
    const store = makeStore();

    await run(store, [DIRTY], 'confirmed');

    expect(removeWorktreeFolder).toHaveBeenCalledWith({
      repoPath: '/repo',
      path: DIRTY,
      mode: 'confirmed',
    });
  });

  it('reports a folder the removal threw on as failed and keeps it listed', async () => {
    removeWorktreeFolder.mockRejectedValueOnce(new Error('git failed'));
    const store = makeStore();

    const outcomes = await run(store, [GHOST]);

    expect(outcomes).toEqual([{ kind: 'failed', path: GHOST, message: 'git failed' }]);
    expect(store.orphanWorktrees['ws-1']).toHaveLength(3);
  });
});
