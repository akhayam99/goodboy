import { deleteSessionMount } from '@goodboy/db';
import type { SessionMountView } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { clearMountBranchObservation } from './mountBranchObservations';
import { mountError } from './mountErrors';
import { loadMountViews, requireMountView } from './mountViews';
import { settleMountCleanupProposals } from './settleMountProposals';
import type { GetFn, MountKeyInput, SetFn } from './types';

export type ForgetMountResult = {
  readonly keptPath: string | null;
};

export const forgetMount = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: MountKeyInput): Promise<ForgetMountResult> => {
    const rendered = (get().sessionMounts[sessionId] ?? []).find(
      (candidate) => candidate.id === mountId,
    );
    const view: SessionMountView =
      rendered ?? requireMountView({ views: await loadMountViews({ get, sessionId }), mountId });
    if (view.isAttached && view.worktreePath !== null) {
      throw mountError({
        code: 'directory-busy',
        message: 'unmount the branch before removing it from the session',
        mountId,
      });
    }
    const isOnDisk = view.diskState !== 'missing' && view.diskState !== 'removed';
    await settleMountCleanupProposals({
      set,
      sessionId,
      mountId,
      outcome: isOnDisk ? 'kept' : 'removed',
    });
    await deleteSessionMount({ db: tauriDatabase, sessionId, mountId });
    set((state) => {
      const stored = state.sessionMounts[sessionId];
      return stored === undefined
        ? {}
        : {
            sessionMounts: {
              ...state.sessionMounts,
              [sessionId]: stored.filter((candidate) => candidate.id !== mountId),
            },
          };
    });
    clearMountBranchObservation({ set, sessionId, mountId });
    const keptPath = isOnDisk ? view.lastWorktreePath : null;
    if (keptPath !== null) {
      void get()
        .reconcileOrphanWorktrees()
        .catch(() => undefined);
    }
    return { keptPath };
  };
};
