// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonitorSnapshot } from '@goodboy/core';
import {
  brandId,
  type MountId,
  type MountOperation,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store';
import type { TerminalTabId } from '../../../shared/types/terminal';
import type { StorageFolder, StorageRemovalSummary, StorageRestoreTarget } from './types';

const {
  listArchivedSessionRefs,
  deleteTurnEventsForSessions,
  vacuumDatabase,
  updateSessionMountLifecycle,
  deleteWorktreeLedgerEntries,
  setWorktreeLedgerKeep,
  removeWorktreeChecked,
  removeWorktreeFolder,
  restoreWorktreeFolder,
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
  restoreWorktreeFolder: vi.fn(),
  worktreeWriterStatus: vi.fn(),
}));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    listArchivedSessionRefs,
    deleteTurnEventsForSessions,
    updateSessionMountLifecycle,
    deleteWorktreeLedgerEntries,
    setWorktreeLedgerKeep,
    getMountOperation: vi.fn(
      async ({ requestId }: { readonly requestId: string }) => operations.get(requestId) ?? null,
    ),
    upsertMountOperation: vi.fn(async ({ operation }: { readonly operation: MountOperation }) => {
      operations.set(operation.requestId, operation);
    }),
  }),
);

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {}, vacuumDatabase }));

vi.mock('../../../features/worktree/worktree', () => ({
  removeWorktreeChecked,
  removeWorktreeFolder,
  restoreWorktreeFolder,
  worktreeWriterStatus,
}));

import { keepStorageFolder } from './keepStorageFolder';
import { pruneArchivedTranscripts } from './pruneArchivedTranscripts';
import { removeStorageFolders } from './removeStorageFolders';
import { STORAGE_KEPT_ARCHIVED_KEY } from './storageSettings';
import { undoStorageRemoval } from './undoStorageRemoval';

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

const ARCHIVED_RESTORE: StorageRestoreTarget = {
  path: '/repo/.goodboy/worktrees/archived',
  repoRoot: '/repo',
  branch: 'goodboy/archived',
  origin: 'archived',
  sessionId: ARCHIVED_SESSION,
  mountId: brandId<MountId>({ value: 'wt-archived' }),
  revision: 4,
};

const ORPHAN_RESTORE: StorageRestoreTarget = {
  path: '/repo/.goodboy/worktrees/ghost',
  repoRoot: '/repo',
  branch: 'goodboy/ghost',
  origin: 'ledger',
  sessionId: null,
  mountId: null,
  revision: null,
};

const outcomeOf = (restorable: ReadonlyArray<StorageRestoreTarget>): StorageRemovalSummary => ({
  removed: restorable.length,
  freedBytes: 0,
  kept: [],
  restorable,
  undo: null,
  isUndoing: false,
});

type Harness = {
  state: {
    storageFolders: ReadonlyArray<StorageFolder>;
    storageRemovingPaths: Readonly<Record<string, true>>;
    storageOutcome: StorageRemovalSummary | null;
    settings: Readonly<Record<string, string>>;
    monitorSnapshot?: MonitorSnapshot | null;
    monitorError?: string | null;
  };
  refreshMonitorSnapshot: ReturnType<typeof vi.fn>;
  loadStorage: ReturnType<typeof vi.fn>;
  reportError: ReturnType<typeof vi.fn>;
  saveSetting: ReturnType<typeof vi.fn>;
};

const idleSnapshot = (): MonitorSnapshot => ({
  listeners: [],
  processes: [],
  takenAt: 1,
  isPlatformSupported: true,
});

const makeHarness = (folders: ReadonlyArray<StorageFolder>): Harness => {
  const harness: Harness = {
    state: {
      storageFolders: folders,
      storageRemovingPaths: {},
      storageOutcome: null,
      settings: {},
      monitorSnapshot: null,
      monitorError: null,
    },
    refreshMonitorSnapshot: vi.fn(async () => undefined),
    loadStorage: vi.fn(async () => undefined),
    reportError: vi.fn(),
    saveSetting: vi.fn(async () => undefined),
  };
  harness.refreshMonitorSnapshot.mockImplementation(async () => {
    harness.state.monitorSnapshot ??= idleSnapshot();
  });
  return harness;
};

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
      reportError: harness.reportError,
      refreshMonitorSnapshot: harness.refreshMonitorSnapshot,
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
  restoreWorktreeFolder.mockImplementation(async ({ path }: { path: string }) => ({
    kind: 'restored',
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
    expect(summary).toEqual({
      removed: 2,
      freedBytes: 5096,
      kept: [],
      restorable: [ARCHIVED_RESTORE, ORPHAN_RESTORE],
      undo: null,
      isUndoing: false,
    });
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

  it('refreshes the monitor snapshot before each removal and sees a fresh process', async () => {
    const harness = makeHarness([orphan]);
    harness.state.monitorSnapshot = idleSnapshot();
    harness.refreshMonitorSnapshot.mockImplementation(async () => {
      harness.state.monitorSnapshot = {
        ...idleSnapshot(),
        takenAt: 2,
        processes: [
          {
            pid: 91,
            ppid: 1,
            pgid: 91,
            name: 'next-server',
            cwd: orphan.path,
            startedAt: 1,
            cpuPercent: 0,
            rssBytes: 0,
            uid: 501,
            argsMasked: '',
          },
        ],
      };
    });
    const { set, get } = wire(harness);

    const summary = await removeStorageFolders(set, get)({ paths: [orphan.path], mode: 'safe' });

    expect(harness.refreshMonitorSnapshot).toHaveBeenCalledTimes(1);
    expect(summary.removed).toBe(0);
    expect(removeWorktreeFolder).not.toHaveBeenCalled();
  });

  it('refuses to remove when the monitor cannot be read', async () => {
    const harness = makeHarness([orphan]);
    harness.refreshMonitorSnapshot.mockImplementation(async () => {
      harness.state.monitorError = 'monitor_snapshot failed';
    });
    const { set, get } = wire(harness);

    const summary = await removeStorageFolders(set, get)({ paths: [orphan.path], mode: 'safe' });

    expect(summary.removed).toBe(0);
    expect(summary.kept).toEqual([
      {
        kind: 'kept',
        path: orphan.path,
        reasons: [],
        message: 'Could not check for running processes, so this folder was kept',
      },
    ]);
    expect(removeWorktreeFolder).not.toHaveBeenCalled();
  });

  it('refuses to remove when the platform cannot list processes', async () => {
    const harness = makeHarness([orphan]);
    harness.refreshMonitorSnapshot.mockImplementation(async () => {
      harness.state.monitorSnapshot = { ...idleSnapshot(), isPlatformSupported: false };
    });
    const { set, get } = wire(harness);

    const summary = await removeStorageFolders(set, get)({ paths: [orphan.path], mode: 'safe' });

    expect(summary.removed).toBe(0);
    expect(removeWorktreeFolder).not.toHaveBeenCalled();
  });

  it('keeps a folder a process still runs in and says so', async () => {
    const harness = makeHarness([orphan]);
    harness.state.monitorSnapshot = {
      listeners: [],
      processes: [
        {
          pid: 90,
          ppid: 1,
          pgid: 90,
          name: 'next-server',
          cwd: `${orphan.path}/apps/web`,
          startedAt: 1,
          cpuPercent: 0,
          rssBytes: 0,
          uid: 501,
          argsMasked: '',
        },
      ],
      takenAt: 1,
      isPlatformSupported: true,
    };
    const { set, get } = wire(harness);

    const summary = await removeStorageFolders(set, get)({ paths: [orphan.path], mode: 'safe' });

    expect(summary.removed).toBe(0);
    expect(summary.kept).toEqual([
      {
        kind: 'kept',
        path: orphan.path,
        reasons: [],
        message: 'a process is running in the worktree',
      },
    ]);
    expect(removeWorktreeFolder).not.toHaveBeenCalled();
  });

  it('keeps a ledger folder a shell opened in after the click and says so', async () => {
    const harness = makeHarness([orphan]);
    const { set, get } = wire(harness);
    const withShell = () => ({
      ...get(),
      terminalTabs: {
        'session-1': [
          {
            id: brandId<TerminalTabId>({ value: 'terminal-1' }),
            owner: { kind: 'session' as const, sessionId: ARCHIVED_SESSION },
            title: 'dev server',
            cwd: orphan.path,
            status: 'running' as const,
            createdAt: 1,
          },
        ],
      },
    });

    const summary = await removeStorageFolders(
      set,
      withShell,
    )({ paths: [orphan.path], mode: 'safe' });

    expect(removeWorktreeFolder).not.toHaveBeenCalled();
    expect(summary.removed).toBe(0);
    expect(summary.kept).toEqual([
      expect.objectContaining({
        kind: 'kept',
        path: orphan.path,
        message: 'a terminal is open in the worktree',
      }),
    ]);
    expect(summary.restorable).toEqual([]);
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

describe('undoStorageRemoval', () => {
  it('brings an archived folder back on its branch and puts the session mount row back', async () => {
    const harness = makeHarness([]);
    harness.state.storageOutcome = outcomeOf([ARCHIVED_RESTORE]);
    const { set, get } = wire(harness);

    await undoStorageRemoval({ set, get })();

    expect(restoreWorktreeFolder).toHaveBeenCalledWith({
      repoPath: '/repo',
      path: ARCHIVED_RESTORE.path,
      branch: 'goodboy/archived',
    });
    expect(updateSessionMountLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: ARCHIVED_SESSION,
        mountId: 'wt-archived',
        worktreePath: ARCHIVED_RESTORE.path,
        isAttached: true,
        diskState: 'present',
        expectedRevision: 4,
      }),
    );
    expect(harness.state.storageOutcome).toMatchObject({
      restorable: [],
      undo: { restored: 1, failed: [] },
      isUndoing: false,
    });
    expect(harness.loadStorage).toHaveBeenCalled();
  });

  it('brings a ledger folder back without touching any session row', async () => {
    const harness = makeHarness([]);
    harness.state.storageOutcome = outcomeOf([ORPHAN_RESTORE]);
    const { set, get } = wire(harness);

    await undoStorageRemoval({ set, get })();

    expect(restoreWorktreeFolder).toHaveBeenCalledWith({
      repoPath: '/repo',
      path: ORPHAN_RESTORE.path,
      branch: 'goodboy/ghost',
    });
    expect(updateSessionMountLifecycle).not.toHaveBeenCalled();
    expect(harness.state.storageOutcome?.undo).toEqual({ restored: 1, failed: [] });
  });

  it('keeps a refused folder in the list so the undo can be tried again, and never overwrites', async () => {
    restoreWorktreeFolder.mockResolvedValueOnce({ kind: 'restored', path: ARCHIVED_RESTORE.path });
    restoreWorktreeFolder.mockResolvedValueOnce({
      kind: 'refused',
      path: ORPHAN_RESTORE.path,
      reason: 'path-taken',
    });
    const harness = makeHarness([]);
    harness.state.storageOutcome = outcomeOf([ARCHIVED_RESTORE, ORPHAN_RESTORE]);
    const { set, get } = wire(harness);

    await undoStorageRemoval({ set, get })();

    expect(harness.state.storageOutcome).toMatchObject({
      restorable: [ORPHAN_RESTORE],
      undo: {
        restored: 1,
        failed: [{ path: ORPHAN_RESTORE.path, message: 'a folder already exists there' }],
      },
    });

    await undoStorageRemoval({ set, get })();

    expect(restoreWorktreeFolder).toHaveBeenCalledTimes(3);
    expect(harness.state.storageOutcome?.undo).toEqual({
      restored: 1,
      failed: [],
    });
  });

  it('reports a thrown restore and still restores the others', async () => {
    restoreWorktreeFolder.mockRejectedValueOnce(new Error('git failed: worktree add'));
    const harness = makeHarness([]);
    harness.state.storageOutcome = outcomeOf([ORPHAN_RESTORE, ARCHIVED_RESTORE]);
    const { set, get } = wire(harness);

    await undoStorageRemoval({ set, get })();

    expect(harness.state.storageOutcome?.undo?.restored).toBe(1);
    expect(harness.state.storageOutcome?.undo?.failed).toEqual([
      { path: ORPHAN_RESTORE.path, message: expect.stringContaining('git failed') },
    ]);
    expect(harness.state.storageOutcome?.restorable).toEqual([ORPHAN_RESTORE]);
  });

  it('says so when the session row moved while the folder came back', async () => {
    updateSessionMountLifecycle.mockResolvedValueOnce(false);
    const harness = makeHarness([]);
    harness.state.storageOutcome = outcomeOf([ARCHIVED_RESTORE]);
    const { set, get } = wire(harness);

    await undoStorageRemoval({ set, get })();

    expect(harness.state.storageOutcome?.undo?.failed).toEqual([
      {
        path: ARCHIVED_RESTORE.path,
        message: 'the folder is back, but its session changed in the meantime',
      },
    ]);
  });

  it('drops a late answer when the notice was dismissed or replaced meanwhile', async () => {
    const harness = makeHarness([]);
    harness.state.storageOutcome = outcomeOf([ORPHAN_RESTORE]);
    const { set, get } = wire(harness);
    restoreWorktreeFolder.mockImplementationOnce(async ({ path }: { path: string }) => {
      harness.state.storageOutcome = null;
      return { kind: 'restored', path };
    });

    await undoStorageRemoval({ set, get })();

    expect(harness.state.storageOutcome).toBeNull();
    expect(harness.loadStorage).toHaveBeenCalled();
  });

  it('reports a failed refresh instead of swallowing it', async () => {
    const harness = makeHarness([]);
    harness.state.storageOutcome = outcomeOf([ORPHAN_RESTORE]);
    harness.loadStorage.mockRejectedValueOnce(new Error('database is locked'));
    const { set, get } = wire(harness);

    await undoStorageRemoval({ set, get })();

    expect(harness.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't refresh Storage" }),
    );
    expect(harness.state.storageOutcome?.undo).toEqual({ restored: 1, failed: [] });
  });

  it('ignores a second click while the first undo runs and an empty list', async () => {
    const harness = makeHarness([]);
    harness.state.storageOutcome = { ...outcomeOf([ORPHAN_RESTORE]), isUndoing: true };
    const { set, get } = wire(harness);

    await undoStorageRemoval({ set, get })();

    harness.state.storageOutcome = outcomeOf([]);
    await undoStorageRemoval({ set, get })();

    expect(restoreWorktreeFolder).not.toHaveBeenCalled();
  });
});

describe('removal and its undo target', () => {
  it('offers no undo for a folder whose branch is unknown', async () => {
    const nameless = folder({ branch: '', path: '/repo/.goodboy/worktrees/nameless' });
    const harness = makeHarness([nameless]);
    const { set, get } = wire(harness);

    const summary = await removeStorageFolders(set, get)({ paths: [nameless.path], mode: 'safe' });

    expect(summary.removed).toBe(1);
    expect(summary.restorable).toEqual([]);
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
