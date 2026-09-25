import {
  getDatabaseSizeBytes,
  getTurnEventStatsForSessions,
  listArchivedSessionRefs,
  listStorageMounts,
  listStorageSessionRefs,
  listWorktreeLedger,
  listWorktreeRoots,
} from '@goodboy/db';
import type { SessionId, WorktreeRoot } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { appDataUsage, type AppDataUsage } from '../../../features/storage/storage';
import {
  diskFree,
  worktreeFolderFacts,
  type WorktreeFolderFacts,
} from '../../../features/worktree/worktree';
import { buildStorageFolders } from './buildStorageFolders';
import {
  STORAGE_KEPT_ARCHIVED_KEY,
  STORAGE_SUGGEST_AFTER_KEY,
  keptArchivedOf,
} from './storageSettings';
import type { GetFn, SetFn, StorageRoot } from './types';

type LoadParams = {
  readonly isForced?: boolean;
};

const EMPTY_APP_DATA: AppDataUsage = {
  folder: '',
  databaseBytes: 0,
  snapshotBytes: 0,
  snapshotCount: 0,
};

const toStorageRoot = (root: WorktreeRoot): StorageRoot => ({
  repoRoot: root.repoRoot,
  projectName: root.projectName ?? root.repoRoot.split('/').filter(Boolean).at(-1) ?? root.repoRoot,
  workspaceId: root.workspaceId,
  workspaceName: root.workspaceName,
  isDisconnected: root.isDisconnected,
});

type FreeBytesParams = {
  readonly folder: string;
};

const readFreeBytes = async ({ folder }: FreeBytesParams): Promise<number | null> => {
  if (folder === '') {
    return null;
  }
  try {
    return (await diskFree({ path: folder })).freeBytes;
  } catch {
    return null;
  }
};

export const loadStorage = (set: SetFn, get: GetFn) => {
  return async ({ isForced = false }: LoadParams = {}): Promise<void> => {
    set({ storageStatsLoading: true });
    try {
      await Promise.all([
        get().loadSetting(STORAGE_SUGGEST_AFTER_KEY),
        get().loadSetting(STORAGE_KEPT_ARCHIVED_KEY),
      ]).catch(() => undefined);
      await get()
        .reconcileOrphanWorktrees()
        .catch(() => undefined);
      const refs = await listArchivedSessionRefs({ db: tauriDatabase });
      const [databaseBytes, transcripts, mounts, ledger, roots, appData] = await Promise.all([
        getDatabaseSizeBytes({ db: tauriDatabase }),
        getTurnEventStatsForSessions({
          db: tauriDatabase,
          sessionIds: refs.map((ref) => ref.sessionId),
        }),
        listStorageMounts({ db: tauriDatabase }),
        listWorktreeLedger({ db: tauriDatabase }),
        listWorktreeRoots({ db: tauriDatabase }),
        appDataUsage().catch(() => EMPTY_APP_DATA),
      ]);
      const ledgerSessions = ledger
        .map((entry) => entry.sourceSessionId)
        .filter((id): id is SessionId => id !== null);
      const [sessionRefs, freeBytes, facts] = await Promise.all([
        listStorageSessionRefs({ db: tauriDatabase, sessionIds: [...new Set(ledgerSessions)] }),
        readFreeBytes({ folder: appData.folder }),
        worktreeFolderFacts({
          requests: [
            ...mounts
              .filter((mount) => mount.archivedAt !== null && mount.repoRoot !== null)
              .map((mount) => ({ repoRoot: mount.repoRoot ?? '', path: mount.worktreePath })),
            ...ledger
              .filter((entry) => entry.repoRoot !== '')
              .map((entry) => ({ repoRoot: entry.repoRoot, path: entry.worktreePath })),
          ],
        }).catch((): ReadonlyArray<WorktreeFolderFacts> => []),
      ]);
      const folders = buildStorageFolders({
        mounts,
        ledger,
        sessionRefs,
        keptArchived: keptArchivedOf({ settings: get().settings }),
        sizes: get().storageSizeCache,
        facts: new Map(facts.map((fact) => [fact.path, fact])),
      });
      set({
        storageStats: {
          databaseBytes,
          archivedSessionCount: refs.length,
          archivedTranscriptRows: transcripts.rowCount,
          archivedTranscriptBytes: transcripts.payloadBytes,
          snapshotBytes: appData.snapshotBytes,
          snapshotCount: appData.snapshotCount,
          appDataFolder: appData.folder === '' ? null : appData.folder,
          diskFreeBytes: freeBytes,
          checkedAt: Date.now(),
        },
        storageFolders: folders,
        storageRoots: roots.map(toStorageRoot),
        storageStatsLoading: false,
      });
      void get()
        .measureStorageSizes({ isForced })
        .catch(() => undefined);
    } catch (err) {
      set({ storageStatsLoading: false });
      throw err;
    }
  };
};
