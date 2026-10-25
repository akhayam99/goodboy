import { updateSessionMountLifecycle } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { nowIso } from '../project-mounts/nowIso';
import {
  restoreWorktreeFolder,
  type WorktreeRestoreRefusal,
} from '../../../features/worktree/worktree';
import type { SliceDeps } from '../../slice-types';
import type { StorageRestoreTarget } from './types';

const REFUSAL_COPY = {
  'outside-worktree-folder': 'the path is outside the Goodboy worktree folder',
  'path-taken': 'a folder already exists there',
  'branch-missing': 'its branch no longer exists',
  'branch-in-use': 'its branch is checked out in another folder',
} as const satisfies Record<WorktreeRestoreRefusal, string>;

type RestoreParams = {
  readonly target: StorageRestoreTarget;
};

const restoreOne = async ({ target }: RestoreParams): Promise<string | null> => {
  const result = await restoreWorktreeFolder({
    repoPath: target.repoRoot,
    path: target.path,
    branch: target.branch,
  });
  if (result.kind === 'refused') {
    return REFUSAL_COPY[result.reason];
  }
  const { sessionId, mountId, revision } = target;
  if (target.origin !== 'archived' || sessionId === null || mountId === null || revision === null) {
    return null;
  }
  const isWritten = await updateSessionMountLifecycle({
    db: tauriDatabase,
    sessionId,
    mountId,
    worktreePath: target.path,
    isAttached: true,
    diskState: 'present',
    expectedRevision: revision,
    updatedAt: nowIso({}),
  });
  return isWritten ? null : 'the folder is back, but its session changed in the meantime';
};

export const undoStorageRemoval = ({ set, get }: SliceDeps) => {
  return async (): Promise<void> => {
    const outcome = get().storageOutcome;
    if (outcome === null || outcome.isUndoing || outcome.restorable.length === 0) {
      return;
    }
    const targets = outcome.restorable;
    set({ storageOutcome: { ...outcome, isUndoing: true } });
    const restored = new Set<string>();
    const failed: Array<{ readonly path: string; readonly message: string }> = [];
    for (const target of targets) {
      let problem: string | null;
      try {
        problem = await restoreOne({ target });
      } catch (error) {
        failed.push({ path: target.path, message: formatError(error) });
        continue;
      }
      if (problem === null) {
        restored.add(target.path);
        continue;
      }
      failed.push({ path: target.path, message: problem });
    }
    set((state) => {
      if (state.storageOutcome === null || state.storageOutcome.restorable !== targets) {
        return {};
      }
      return {
        storageOutcome: {
          ...state.storageOutcome,
          isUndoing: false,
          restorable: targets.filter((target) => !restored.has(target.path)),
          undo: { restored: restored.size, failed },
        },
      };
    });
    try {
      await get().loadStorage();
    } catch (error) {
      await get().reportError({ title: "Couldn't refresh Storage", error });
    }
  };
};
