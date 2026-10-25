import { deleteWorktreeLedgerEntries, updateSessionMountLifecycle } from '@goodboy/db';
import type { IsoDateTime, WorktreeRemovalMode } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { terminalsInFolder } from '../../../features/terminal/terminalsInFolder';
import { removeWorktreeFolder } from '../../../features/worktree/worktree';
import { MOUNT_CLEANUP_BLOCKER_REASON, processesInWorktree } from '../mount-cleanup/cleanupPolicy';
import { runMountRemoval } from '../project-mounts/runMountRemoval';
import type {
  GetFn,
  RemoveStorageFoldersParams,
  SetFn,
  StorageFolder,
  StorageRemoval,
  StorageRemovalSummary,
  StorageRestoreTarget,
} from './types';

type FolderRemovalParams = {
  readonly get: GetFn;
  readonly folder: StorageFolder;
  readonly mode: WorktreeRemovalMode;
};

type RestoreTargetParams = {
  readonly folder: StorageFolder;
};

const restoreTargetOf = ({ folder }: RestoreTargetParams): StorageRestoreTarget | null => {
  if (folder.branch === '' || folder.origin === 'in-use') {
    return null;
  }
  return {
    path: folder.path,
    repoRoot: folder.repoRoot,
    branch: folder.branch,
    origin: folder.origin,
    sessionId: folder.sessionId,
    mountId: folder.mountId,
    revision: folder.revision === null ? null : folder.revision + 1,
  };
};

const removedOutcome = ({ folder }: RestoreTargetParams): StorageRemoval => ({
  kind: 'removed',
  path: folder.path,
  sizeBytes: folder.sizeBytes ?? 0,
  restore: restoreTargetOf({ folder }),
});

const removeArchived = async ({
  get,
  folder,
  mode,
}: FolderRemovalParams): Promise<StorageRemoval> => {
  const { sessionId, mountId, revision } = folder;
  if (sessionId === null || mountId === null || revision === null) {
    return { kind: 'failed', path: folder.path, message: 'This folder has no session mount' };
  }
  const result = await runMountRemoval({
    get,
    mode,
    keepDirectory: false,
    finish: 'clear-path',
    expectedRevision: revision,
    target: {
      sessionId,
      mountId,
      projectId: null,
      repoRoot: folder.repoRoot,
      worktreePath: folder.path,
      branch: folder.branch,
      diskState: 'present',
      isRepoProject: true,
    },
    finishRow: async ({ decision, diskState }) => {
      if (decision.kind === 'kept') {
        return true;
      }
      return updateSessionMountLifecycle({
        db: tauriDatabase,
        sessionId,
        mountId,
        worktreePath: null,
        isAttached: false,
        diskState,
        expectedRevision: revision,
        updatedAt: new Date().toISOString() as IsoDateTime,
      });
    },
  });
  const decision = result.decision;
  switch (decision.kind) {
    case 'removed':
    case 'missing':
      return removedOutcome({ folder });
    case 'kept':
      return { kind: 'kept', path: folder.path, reasons: [], message: decision.reason };
    case 'failed':
      return { kind: 'failed', path: folder.path, message: decision.reason };
    default: {
      const exhaustive: never = decision;
      return exhaustive;
    }
  }
};

const removeLedger = async ({ folder, mode }: FolderRemovalParams): Promise<StorageRemoval> => {
  const result = await removeWorktreeFolder({
    repoPath: folder.repoRoot,
    path: folder.path,
    mode,
    allowLocalCommits: true,
  });
  if (result.kind === 'kept') {
    return { kind: 'kept', path: folder.path, reasons: result.reasons, message: null };
  }
  if (folder.ledgerId !== null) {
    await deleteWorktreeLedgerEntries({ db: tauriDatabase, ids: [folder.ledgerId] }).catch(
      () => undefined,
    );
  }
  return removedOutcome({ folder });
};

const MONITOR_UNREADABLE_REASON = 'Could not check for running processes, so this folder was kept';

const keptFor = ({
  folder,
  message,
}: {
  readonly folder: StorageFolder;
  readonly message: string;
}) => ({ kind: 'kept', path: folder.path, reasons: [], message }) satisfies StorageRemoval;

const removeOne = async ({ get, folder, mode }: FolderRemovalParams): Promise<StorageRemoval> => {
  try {
    await get().refreshMonitorSnapshot();
  } catch {
    return keptFor({ folder, message: MONITOR_UNREADABLE_REASON });
  }
  const { monitorSnapshot, monitorError } = get();
  if (monitorError !== null || monitorSnapshot === null || !monitorSnapshot.isPlatformSupported) {
    return keptFor({ folder, message: MONITOR_UNREADABLE_REASON });
  }
  if (processesInWorktree({ snapshot: monitorSnapshot, worktreePath: folder.path }).length > 0) {
    return keptFor({ folder, message: MOUNT_CLEANUP_BLOCKER_REASON['process-running'] });
  }
  const terminals = terminalsInFolder({
    tabs: get().terminalTabs,
    path: folder.path,
    mountId: folder.mountId,
  });
  if (terminals.length > 0) {
    return keptFor({ folder, message: MOUNT_CLEANUP_BLOCKER_REASON['terminal-open'] });
  }
  try {
    if (folder.origin === 'archived') {
      return await removeArchived({ get, folder, mode });
    }
    if (folder.origin === 'ledger') {
      return await removeLedger({ get, folder, mode });
    }
    return { kind: 'kept', path: folder.path, reasons: [], message: 'In use' };
  } catch (error) {
    return { kind: 'failed', path: folder.path, message: formatError(error) };
  }
};

export const removeStorageFolders = (set: SetFn, get: GetFn) => {
  return async ({ paths, mode }: RemoveStorageFoldersParams): Promise<StorageRemovalSummary> => {
    const outcomes: Array<StorageRemoval> = [];
    for (const path of paths) {
      const folder = get().storageFolders.find((candidate) => candidate.path === path);
      if (folder === undefined) {
        continue;
      }
      set((state) => ({ storageRemovingPaths: { ...state.storageRemovingPaths, [path]: true } }));
      const outcome = await removeOne({ get, folder, mode });
      outcomes.push(outcome);
      set((state) => {
        const removing = Object.fromEntries(
          Object.entries(state.storageRemovingPaths).filter(([candidate]) => candidate !== path),
        );
        return {
          storageRemovingPaths: removing,
          storageFolders:
            outcome.kind === 'removed'
              ? state.storageFolders.filter((candidate) => candidate.path !== path)
              : state.storageFolders,
        };
      });
    }
    const removed = outcomes.filter((outcome) => outcome.kind === 'removed');
    const summary: StorageRemovalSummary = {
      removed: removed.length,
      freedBytes: removed.reduce(
        (sum, outcome) => sum + (outcome.kind === 'removed' ? outcome.sizeBytes : 0),
        0,
      ),
      kept: outcomes.filter((outcome) => outcome.kind !== 'removed'),
      restorable: removed.flatMap((outcome) =>
        outcome.kind === 'removed' && outcome.restore !== null ? [outcome.restore] : [],
      ),
      undo: null,
      isUndoing: false,
    };
    set({ storageOutcome: summary });
    await get()
      .loadStorage()
      .catch(() => undefined);
    return summary;
  };
};
