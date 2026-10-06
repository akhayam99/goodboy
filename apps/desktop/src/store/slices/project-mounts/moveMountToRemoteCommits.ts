import { updateSessionMountBranch } from '@goodboy/db';
import type { IsoDateTime, SessionMountView } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { moveToRemoteCommits } from '../../../features/worktree/worktree';
import { refreshWorktreeStatuses } from '../worktreeStatuses/cache';
import { mountError } from './mountErrors';
import { withRepositoryAndMountLock } from './mountLocks';
import { applyMountViews, loadMountViews, requireMountView } from './mountViews';
import type { GetFn, MountKeyInput, SetFn } from './types';

export const moveMountToRemoteCommits = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: MountKeyInput): Promise<SessionMountView> => {
    const views = await loadMountViews({ get, sessionId });
    const view = requireMountView({ views, mountId });
    const worktreePath = view.worktreePath;
    if (worktreePath === null || !view.isAttached || view.branch === '') {
      throw mountError({
        code: 'branch-missing',
        message: 'attach this mount on a branch before using the pull request commits',
        mountId,
      });
    }
    return withRepositoryAndMountLock({
      repoRoot: view.repoRoot,
      mountKey: `${sessionId}:${mountId}`,
      run: async () => {
        await moveToRemoteCommits({ worktreePath, branch: view.branch });
        const written = await updateSessionMountBranch({
          db: tauriDatabase,
          sessionId,
          mountId,
          branch: view.branch,
          branchOrigin: 'adopted',
          expectedRevision: view.revision,
          updatedAt: new Date().toISOString() as IsoDateTime,
        });
        if (!written) {
          throw mountError({
            code: 'revision-conflict',
            message: 'the mount changed while moving it onto the pull request commits',
            mountId,
          });
        }
        const nextViews = await loadMountViews({ get, sessionId });
        applyMountViews({ set, sessionId, views: nextViews });
        await refreshWorktreeStatuses({ worktreePaths: [worktreePath] });
        void get().refreshSessionPr(sessionId, { mountId, force: true, silent: true });
        return requireMountView({ views: nextViews, mountId });
      },
    });
  };
};
