import { deleteWorktreeLedgerEntries, updateSessionMountLifecycle } from '@goodboy/db';
import type { IsoDateTime, WorktreeRemovalMode } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { removeWorktreeFolder } from '../../../features/worktree/worktree';
import { runMountRemoval } from '../project-mounts/runMountRemoval';
import type {
  GetFn,
  RemoveStorageFoldersParams,
  SetFn,
  StorageFolder,
  StorageRemoval,
  StorageRemovalSummary,
} from './types';

type FolderRemovalParams = {
  readonly get: GetFn;
  readonly folder: StorageFolder;
  readonly mode: WorktreeRemovalMode;
};

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
      return { kind: 'removed', path: folder.path, sizeBytes: folder.sizeBytes ?? 0 };
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
  return { kind: 'removed', path: folder.path, sizeBytes: folder.sizeBytes ?? 0 };
};

const removeOne = async ({ get, folder, mode }: FolderRemovalParams): Promise<StorageRemoval> => {
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
    };
    set({ storageOutcome: summary });
    await get()
      .loadStorage()
      .catch(() => undefined);
    return summary;
  };
};
