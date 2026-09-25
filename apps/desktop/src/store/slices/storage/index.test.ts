import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, MountOperation, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { StorageFolder } from './types';

const {
  listArchivedSessionRefs,
  deleteTurnEventsForSessions,
  vacuumDatabase,
  updateSessionMountLifecycle,
  deleteWorktreeLedgerEntries,
  setWorktreeLedgerKeep,
  removeWorktreeChecked,
  removeWorktreeFolder,
  worktreeWriterStatus,
  operations,
} = vi.hoisted(() => ({
  operations: new Map<string, MountOperation>(),
  listArchivedSessionRefs: vi.fn(),
  deleteTurnEventsForSessions: vi.fn(),
  vacuumDatabase: vi.fn(),
  updateSessionMountLifecycle: vi.fn(),
  deleteWorktreeLedgerEntries: vi.fn(async () => undefined),
  setWorktreeLedgerKeep: vi.fn(
    async (_params: { readonly keptAt: string | null; readonly keptUntil: string | null }) =>
      undefined,
  ),
  removeWorktreeChecked: vi.fn(),
  removeWorktreeFolder: vi.fn(),
  worktreeWriterStatus: vi.fn(),
}));

vi.mock('@goodboy/db', () => ({
  listArchivedSessionRefs,
  deleteTurnEventsForSessions,
  vacuumDatabase,
  updateSessionMountLifecycle,
  deleteWorktreeLedgerEntries,
  setWorktreeLedgerKeep,
  getMountOperation: vi.fn(
    async ({ requestId }: { readonly requestId: string }) => operations.get(requestId) ?? null,
  ),
  upsertMountOperation: vi.fn(async ({ operation }: { readonly operation: MountOperation }) => {
    operations.set(operation.requestId, operation);
  }),
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/worktree/worktree', () => ({
  removeWorktreeChecked,
  removeWorktreeFolder,
  worktreeWriterStatus,
}));

import { keepStorageFolder } from './keepStorageFolder';
import { pruneArchivedTranscripts } from './pruneArchivedTranscripts';
import { removeStorageFolders } from './removeStorageFolders';
import { STORAGE_KEPT_ARCHIVED_KEY } from './storageSettings';

const ARCHIVED_SESSION = 'session-archived' as SessionId;

const folder = (overrides: Partial<StorageFolder>): StorageFolder => ({
  path: '/repo/.goodboy/worktrees/archived',
  repoRoot: '/repo',
  branch: 'goodboy/archived',
  origin: 'archived',
  why: 'archived-session',
  sessionId: ARCHIVED_SESSION,
  sessionGoal: 'Settle batch retry',
  mountId: 'wt-archived' as MountId,
  revision: 3,
  ledgerId: null,
  workspaceId: 'workspace-1' as WorkspaceId,
  sessionActivityAt: 1,
  sizeBytes: 4096,
  sizedAt: 1,
  facts: null,
  keptAt: null,
  keptUntil: null,
  ...overrides,
});

const orphan = folder({
  path: '/repo/.goodboy/worktrees/ghost',
  branch: 'goodboy/ghost',
  origin: 'ledger',
  why: 'no-session',
  sessionId: null,
  mountId: null,
  revision: null,
  ledgerId: 'ledger-ghost',
  sizeBytes: 1000,
});

type Harness = {
  state: {
    storageFolders: ReadonlyArray<StorageFolder>;
    storageRemovingPaths: Readonly<Record<string, true>>;
    storageOutcome: unknown;
    settings: Readonly<Record<string, string>>;
  };
  loadStorage: ReturnType<typeof vi.fn>;
  saveSetting: ReturnType<typeof vi.fn>;
};

const makeHarness = (folders: ReadonlyArray<StorageFolder>): Harness => ({
  state: { storageFolders: folders, storageRemovingPaths: {}, storageOutcome: null, settings: {} },
  loadStorage: vi.fn(async () => undefined),
  saveSetting: vi.fn(async () => undefined),
});

const wire = (harness: Harness) => {
  const set = vi.fn((updater: unknown) => {
    const patch =
      typeof updater === 'function'
        ? (updater as (state: Harness['state']) => object)(harness.state)
        : updater;
    Object.assign(harness.state, patch);
  });
  const get = () =>
    ({
      ...harness.state,
      projects: [],
      sessions: [],
      terminalTabs: {},
      loadStorage: harness.loadStorage,
      saveSetting: harness.saveSetting,
    }) as unknown as AppStore;
  return { set, get };
};

beforeEach(() => {
  vi.clearAllMocks();
  operations.clear();
  listArchivedSessionRefs.mockResolvedValue([
    { sessionId: ARCHIVED_SESSION, workspaceId: 'workspace-1' },
  ]);
  deleteTurnEventsForSessions.mockResolvedValue(12);
  updateSessionMountLifecycle.mockResolvedValue(true);
  removeWorktreeChecked.mockImplementation(async ({ worktreePath }: { worktreePath: string }) => ({
    kind: 'removed',
    path: worktreePath,
  }));
  removeWorktreeFolder.mockImplementation(async ({ path }: { path: string }) => ({
    kind: 'removed',
    path,
  }));
  worktreeWriterStatus.mockImplementation(async ({ path }: { path: string }) => ({
    path,
    holder: null,
    token: null,
    runId: null,
    isGranted: false,
    hasExited: false,
    waiting: [],
  }));
});

describe('removeStorageFolders', () => {
  it('removes an archived mount through the checked unmount and a ledger folder through the folder command', async () => {
    const harness = makeHarness([folder({}), orphan]);
    const { set, get } = wire(harness);

    const summary = await removeStorageFolders(
      set,
      get,
    )({
      paths: [folder({}).path, orphan.path],
      mode: 'safe',
    });

    expect(removeWorktreeChecked).toHaveBeenCalledWith({
      repoPath: '/repo',
      worktreePath: '/repo/.goodboy/worktrees/archived',
      mode: 'safe',
    });
    expect(updateSessionMountLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ mountId: 'wt-archived', worktreePath: null, expectedRevision: 3 }),
    );
    expect(removeWorktreeFolder).toHaveBeenCalledWith({
      repoPath: '/repo',
      path: orphan.path,
      mode: 'safe',
      allowLocalCommits: true,
    });
    expect(deleteWorktreeLedgerEntries).toHaveBeenCalledWith({ db: {}, ids: ['ledger-ghost'] });
    expect(summary).toEqual({ removed: 2, freedBytes: 5096, kept: [] });
    expect(harness.state.storageFolders).toEqual([]);
    expect(harness.loadStorage).toHaveBeenCalled();
  });

  it('keeps a folder that changed while the cleanup ran and says why', async () => {
    removeWorktreeFolder.mockResolvedValueOnce({
      kind: 'kept',
      path: orphan.path,
      reasons: ['untracked-files'],
    });
    const harness = makeHarness([orphan]);
    const { set, get } = wire(harness);

    const summary = await removeStorageFolders(set, get)({ paths: [orphan.path], mode: 'safe' });

    expect(summary.removed).toBe(0);
    expect(summary.kept).toEqual([
      { kind: 'kept', path: orphan.path, reasons: ['untracked-files'], message: null },
    ]);
    expect(deleteWorktreeLedgerEntries).not.toHaveBeenCalled();
    expect(harness.state.storageFolders).toEqual([orphan]);
    expect(harness.state.storageRemovingPaths).toEqual({});
  });

  it('reports a thrown removal as failed and never touches a folder in use', async () => {
    removeWorktreeFolder.mockRejectedValueOnce(new Error('git failed'));
    const inUse = folder({ path: '/repo/.goodboy/worktrees/live', origin: 'in-use' });
    const harness = makeHarness([orphan, inUse]);
    const { set, get } = wire(harness);

    const summary = await removeStorageFolders(
      set,
      get,
    )({
      paths: [orphan.path, inUse.path],
      mode: 'safe',
    });

    expect(summary.kept.map((outcome) => outcome.kind)).toEqual(['failed', 'kept']);
    expect(removeWorktreeChecked).not.toHaveBeenCalled();
  });
});

describe('keepStorageFolder', () => {
  it('keeps a ledger folder for thirty days in its row', async () => {
    const harness = makeHarness([orphan]);
    const { set, get } = wire(harness);

    await keepStorageFolder(set, get)({ path: orphan.path, days: 30 });

    const call = setWorktreeLedgerKeep.mock.calls[0]?.[0];
    expect(Date.parse(call?.keptUntil ?? '') - Date.parse(call?.keptAt ?? '')).toBe(
      30 * 24 * 60 * 60 * 1000,
    );
    expect(harness.state.storageFolders[0]?.keptAt).not.toBeNull();
  });

  it('keeps an archived folder in the settings and stops keeping it again', async () => {
    const harness = makeHarness([folder({})]);
    const { set, get } = wire(harness);

    await keepStorageFolder(set, get)({ path: folder({}).path, days: null });
    const saved = harness.saveSetting.mock.calls[0] as unknown as [string, string];
    expect(saved[0]).toBe(STORAGE_KEPT_ARCHIVED_KEY);
    expect(JSON.parse(saved[1])).toEqual({
      [folder({}).path]: { keptAt: expect.any(Number), keptUntil: null },
    });

    await keepStorageFolder(set, get)({ path: folder({}).path, days: null, isStopping: true });
    expect(harness.state.storageFolders[0]).toMatchObject({ keptAt: null, keptUntil: null });
  });
});

describe('pruneArchivedTranscripts', () => {
  it('deletes the archived transcripts, vacuums, then reloads storage', async () => {
    const harness = makeHarness([]);
    const { set, get } = wire(harness);

    const deleted = await pruneArchivedTranscripts(set, get)();

    expect(deleteTurnEventsForSessions).toHaveBeenCalledWith({
      db: {},
      sessionIds: [ARCHIVED_SESSION],
    });
    expect(vacuumDatabase).toHaveBeenCalled();
    expect(deleted).toBe(12);
    expect(harness.loadStorage).toHaveBeenCalled();
  });

  it('does not touch the database when nothing is archived', async () => {
    listArchivedSessionRefs.mockResolvedValue([]);
    const harness = makeHarness([]);
    const { set, get } = wire(harness);

    await expect(pruneArchivedTranscripts(set, get)()).resolves.toBe(0);
    expect(deleteTurnEventsForSessions).not.toHaveBeenCalled();
  });
});
