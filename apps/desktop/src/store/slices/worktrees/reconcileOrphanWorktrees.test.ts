import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listMountPathOwnership,
  listAllRetainedWorktreePaths,
  listUnsettledMountOperations,
  detachSessionMounts,
  deleteRetainedWorktreePath,
  markRetainedWorktreePathChecked,
  scanOrphanWorktrees,
  worktreeDirectorySize,
  listWorktreeRoots,
  listWorktreeLedger,
  markWorktreeRootScanned,
  registerWorktreeRoot,
  deleteWorktreeLedgerEntries,
  recordOrphanWorktrees,
  worktreeFolderFacts,
} = vi.hoisted(() => ({
  listWorktreeRoots: vi.fn(async (): Promise<ReadonlyArray<Record<string, unknown>>> => []),
  listWorktreeLedger: vi.fn(async (): Promise<ReadonlyArray<Record<string, unknown>>> => []),
  markWorktreeRootScanned: vi.fn(async () => undefined),
  registerWorktreeRoot: vi.fn(async () => undefined),
  deleteWorktreeLedgerEntries: vi.fn(
    async (_params: { ids: ReadonlyArray<string> }): Promise<void> => undefined,
  ),
  recordOrphanWorktrees: vi.fn(
    async (_params: { orphans: ReadonlyArray<Record<string, unknown>> }): Promise<void> =>
      undefined,
  ),
  worktreeFolderFacts: vi.fn(async ({ requests }: { requests: ReadonlyArray<{ path: string }> }) =>
    requests.map((request) => ({ path: request.path, branch: 'goodboy/ghost' })),
  ),
  listMountPathOwnership: vi.fn(async () => [
    {
      mountId: 'mount-live',
      sessionId: 'sess-live',
      workspaceId: 'ws-1',
      projectId: 'project-1',
      worktreePath: '/repo/.goodboy/worktrees/gb-live',
      branch: 'ak/live',
      revision: 0,
      isSessionDeleted: false,
      isSessionArchived: false,
    },
  ]),
  listAllRetainedWorktreePaths: vi.fn(
    async (): Promise<ReadonlyArray<Record<string, unknown>>> => [],
  ),
  listUnsettledMountOperations: vi.fn(
    async (): Promise<ReadonlyArray<Record<string, unknown>>> => [],
  ),
  detachSessionMounts: vi.fn(
    async (_params: {
      sessionId: string;
      detached: ReadonlyArray<Record<string, unknown>>;
      retained: ReadonlyArray<Record<string, unknown>>;
    }): Promise<void> => undefined,
  ),
  deleteRetainedWorktreePath: vi.fn(async () => undefined),
  markRetainedWorktreePathChecked: vi.fn(async () => undefined),
  scanOrphanWorktrees: vi.fn(
    async (_params: { repoPath: string; knownPaths: ReadonlyArray<string> }) => [
      {
        path: '/repo/.goodboy/worktrees/gb-ghost',
        name: 'gb-ghost',
        isRegistered: false,
      },
    ],
  ),
  worktreeDirectorySize: vi.fn(async ({ path }: { path: string }) => ({
    path,
    sizeBytes: 2048 as number | null,
    isPartial: false,
    exists: true,
  })),
}));

vi.mock('@goodboy/db', () => ({
  listMountPathOwnership,
  listAllRetainedWorktreePaths,
  listUnsettledMountOperations,
  detachSessionMounts,
  deleteRetainedWorktreePath,
  markRetainedWorktreePathChecked,
  listWorktreeRoots,
  listWorktreeLedger,
  markWorktreeRootScanned,
  registerWorktreeRoot,
  deleteWorktreeLedgerEntries,
  recordOrphanWorktrees,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({
  scanOrphanWorktrees,
  worktreeDirectorySize,
  worktreeFolderFacts,
}));

import { reconcileOrphanWorktrees } from './reconcileOrphanWorktrees';

const emitNotification = vi.fn(async () => undefined);

const makeStore = (kind: string) => ({
  projects: [{ id: 'project-1', workspaceId: 'ws-1', name: 'demo', rootPath: '/repo', kind }],
  orphanWorktrees: {},
  retainedWorktreePaths: {},
  emitNotification,
});

type Store = ReturnType<typeof makeStore>;

const run = async (store: Store) => {
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === 'function' ? (updater as (s: Store) => object)(store) : updater;
    Object.assign(store, patch);
  });
  await reconcileOrphanWorktrees(set as never, (() => store) as never)();
};

beforeEach(() => {
  vi.clearAllMocks();
  listWorktreeRoots.mockResolvedValue([]);
  listWorktreeLedger.mockResolvedValue([]);
  listAllRetainedWorktreePaths.mockResolvedValue([]);
  listUnsettledMountOperations.mockResolvedValue([]);
  listMountPathOwnership.mockResolvedValue([
    {
      mountId: 'mount-live',
      sessionId: 'sess-live',
      workspaceId: 'ws-1',
      projectId: 'project-1',
      worktreePath: '/repo/.goodboy/worktrees/gb-live',
      branch: 'ak/live',
      revision: 0,
      isSessionDeleted: false,
      isSessionArchived: false,
    },
  ]);
});

describe('reconciling the worktrees folder', () => {
  it('reports a folder git forgot, and never counts one a session still owns', async () => {
    const store = makeStore('repo');

    await run(store);

    expect(scanOrphanWorktrees).toHaveBeenCalledWith({
      repoPath: '/repo',
      knownPaths: ['/repo/.goodboy/worktrees/gb-live'],
    });
    expect(store.orphanWorktrees).toEqual({
      'ws-1': [
        {
          path: '/repo/.goodboy/worktrees/gb-ghost',
          name: 'gb-ghost',
          isRegistered: false,
        },
      ],
    });
  });

  it('never notifies by itself, the storage nudge owns that', async () => {
    const store = makeStore('repo');

    await run(store);
    await run(store);

    expect(emitNotification).not.toHaveBeenCalled();
  });

  it('transfers a real folder of a deleted session to retained ownership', async () => {
    listMountPathOwnership.mockResolvedValue([
      {
        mountId: 'mount-gone',
        sessionId: 'sess-gone',
        workspaceId: 'ws-1',
        projectId: 'project-1',
        worktreePath: '/repo/.goodboy/worktrees/gb-gone',
        branch: 'ak/gone',
        revision: 3,
        isSessionDeleted: true,
        isSessionArchived: false,
      },
    ]);
    const store = makeStore('repo');

    await run(store);

    const call = detachSessionMounts.mock.calls[0]?.[0];
    expect(call?.sessionId).toBe('sess-gone');
    expect(call?.detached).toEqual([{ mountId: 'mount-gone', diskState: 'present' }]);
    expect(call?.retained).toEqual([
      expect.objectContaining({
        worktreePath: '/repo/.goodboy/worktrees/gb-gone',
        reason: 'session_delete',
        repoRoot: '/repo',
      }),
    ]);
    expect(scanOrphanWorktrees).toHaveBeenCalledWith({
      repoPath: '/repo',
      knownPaths: ['/repo/.goodboy/worktrees/gb-gone'],
    });
  });

  it('releases the path of a deleted session when the folder is gone', async () => {
    listMountPathOwnership.mockResolvedValue([
      {
        mountId: 'mount-gone',
        sessionId: 'sess-gone',
        workspaceId: 'ws-1',
        projectId: 'project-1',
        worktreePath: '/repo/.goodboy/worktrees/gb-gone',
        branch: 'ak/gone',
        revision: 3,
        isSessionDeleted: true,
        isSessionArchived: false,
      },
    ]);
    worktreeDirectorySize.mockResolvedValue({
      path: '/repo/.goodboy/worktrees/gb-gone',
      sizeBytes: null,
      isPartial: false,
      exists: false,
    });
    const store = makeStore('repo');

    await run(store);

    expect(detachSessionMounts).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-gone',
        detached: [{ mountId: 'mount-gone', diskState: 'removed' }],
        retained: [],
      }),
    );
    expect(scanOrphanWorktrees).toHaveBeenCalledWith({ repoPath: '/repo', knownPaths: [] });
  });

  it('keeps a retained path it cannot read and clears one that is gone', async () => {
    listAllRetainedWorktreePaths.mockResolvedValue([
      {
        id: 'retained-unknown',
        workspaceId: 'ws-1',
        projectId: 'project-1',
        sourceSessionId: 'sess-old',
        sourceMountId: 'mount-old',
        repoRoot: '/repo',
        worktreePath: '/repo/.goodboy/worktrees/gb-unreadable',
        branch: 'ak/old',
        reason: 'session_delete',
        lastCheckedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'retained-gone',
        workspaceId: 'ws-1',
        projectId: 'project-1',
        sourceSessionId: 'sess-old',
        sourceMountId: 'mount-older',
        repoRoot: '/repo',
        worktreePath: '/repo/.goodboy/worktrees/gb-vanished',
        branch: 'ak/older',
        reason: 'session_delete',
        lastCheckedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    worktreeDirectorySize.mockImplementation(async ({ path }: { path: string }) => ({
      path,
      sizeBytes: null,
      isPartial: path.endsWith('gb-unreadable'),
      exists: path.endsWith('gb-unreadable'),
    }));
    const store = makeStore('repo');

    await run(store);

    expect(deleteRetainedWorktreePath).toHaveBeenCalledWith({ db: {}, id: 'retained-gone' });
    expect(markRetainedWorktreePathChecked).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'retained-unknown' }),
    );
    expect(scanOrphanWorktrees.mock.calls[0]?.[0]).toMatchObject({
      knownPaths: expect.arrayContaining(['/repo/.goodboy/worktrees/gb-unreadable']),
    });
  });

  it('registers the roots of repository projects and records their orphans in the ledger', async () => {
    const store = makeStore('repo');

    await run(store);

    expect(registerWorktreeRoot).toHaveBeenCalledWith({
      db: {},
      repoRoot: '/repo',
      addedBy: 'project',
    });
    expect(recordOrphanWorktrees.mock.calls[0]?.[0].orphans).toEqual([
      {
        repoRoot: '/repo',
        worktreePath: '/repo/.goodboy/worktrees/gb-ghost',
        branch: 'goodboy/ghost',
        workspaceId: 'ws-1',
        projectId: 'project-1',
        sizeBytes: null,
      },
    ]);
    expect(markWorktreeRootScanned).toHaveBeenCalledWith(
      expect.objectContaining({ repoRoot: '/repo' }),
    );
  });

  it('scans the root of a disconnected project and keeps it out of the workspace list', async () => {
    listWorktreeRoots.mockResolvedValue([
      {
        repoRoot: '/relay',
        firstSeenAt: '2026-01-01T00:00:00.000Z',
        lastScannedAt: null,
        addedBy: 'project',
        projectId: 'project-relay',
        projectName: 'notify-relay',
        workspaceId: 'ws-2',
        workspaceName: 'Northwind',
        isDisconnected: true,
      },
    ]);
    const store = makeStore('folder');

    await run(store);

    expect(scanOrphanWorktrees).toHaveBeenCalledWith(
      expect.objectContaining({ repoPath: '/relay' }),
    );
    expect(recordOrphanWorktrees.mock.calls[0]?.[0].orphans[0]).toMatchObject({
      repoRoot: '/relay',
      workspaceId: 'ws-2',
      projectId: 'project-relay',
    });
    expect(store.orphanWorktrees).toEqual({});
  });

  it('drops a ledger orphan whose folder is gone and never looks up a known one again', async () => {
    listWorktreeLedger.mockResolvedValue([
      {
        id: 'stale',
        repoRoot: '/repo',
        worktreePath: '/repo/.goodboy/worktrees/gb-vanished',
        reason: 'orphan',
        workspaceId: null,
        sourceSessionId: null,
      },
      {
        id: 'known',
        repoRoot: '/repo',
        worktreePath: '/repo/.goodboy/worktrees/gb-ghost',
        reason: 'orphan',
        workspaceId: 'ws-1',
        sourceSessionId: null,
      },
    ]);
    const store = makeStore('repo');

    await run(store);

    expect(deleteWorktreeLedgerEntries.mock.calls[0]?.[0].ids).toEqual(['stale']);
    expect(worktreeFolderFacts).toHaveBeenCalledWith({ requests: [] });
  });

  it('leaves a folder-backed workspace alone', async () => {
    const store = makeStore('folder');
    const set = vi.fn();

    await reconcileOrphanWorktrees(set as never, (() => store) as never)();

    expect(scanOrphanWorktrees).not.toHaveBeenCalled();
  });
});
