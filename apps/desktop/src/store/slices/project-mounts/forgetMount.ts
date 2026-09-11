import { deleteSessionMount } from '@goodboy/db';
import type { SessionMountView } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { MOUNT_CLEANUP_BLOCKER_REASON, mountCleanupBlockers } from '../mount-cleanup/cleanupPolicy';
import { clearMountBranchObservation } from './mountBranchObservations';
import { mountError } from './mountErrors';
import { withRepositoryAndMountLock } from './mountLocks';
import { loadMountViews, requireMountView } from './mountViews';
import { releaseMountSelection } from './releaseMountSelection';
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
    const blockers = mountCleanupBlockers({
      state: get(),
      sessionId,
      mountId,
      worktreePath: view.worktreePath ?? view.lastWorktreePath ?? '',
    });
    if (blockers.length > 0) {
      throw mountError({
        code: 'directory-busy',
        message: blockers.map((blocker) => MOUNT_CLEANUP_BLOCKER_REASON[blocker]).join(', '),
        mountId,
      });
    }
    const isOnDisk = view.diskState !== 'missing' && view.diskState !== 'removed';
    await withRepositoryAndMountLock({
      repoRoot: view.repoRoot,
      mountKey: `${sessionId}:${mountId}`,
      run: async () => {
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
      },
    });
    const rows = get().sessionMounts[sessionId];
    const departedProjectId =
      rows !== undefined && !rows.some((candidate) => candidate.projectId === view.projectId)
        ? view.projectId
        : null;
    await releaseMountSelection({ set, get, sessionId, released: [mountId], departedProjectId });
    const keptPath = isOnDisk ? view.lastWorktreePath : null;
    if (keptPath !== null) {
      void get()
        .reconcileOrphanWorktrees()
        .catch(() => undefined);
    }
    return { keptPath };
  };
};
