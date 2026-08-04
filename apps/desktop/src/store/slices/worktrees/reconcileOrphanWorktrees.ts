import type { WorkspaceId } from '@goodboy/types';
import { listAllSessionWorktrees } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { scanOrphanWorktrees, type OrphanWorktree } from '../../../features/worktree/worktree';
import type { GetFn, SetFn } from './types';

export const reconcileOrphanWorktrees = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const workspaces = get().workspaces.filter((w) => (w.kind ?? 'repo') === 'repo');
    if (workspaces.length === 0) {
      return;
    }
    const knownPaths = (await listAllSessionWorktrees(tauriDatabase)).map(
      (row) => row.worktreePath,
    );
    const found: Array<[WorkspaceId, ReadonlyArray<OrphanWorktree>]> = [];
    for (const workspace of workspaces) {
      const orphans = await scanOrphanWorktrees({
        repoPath: workspace.rootPath,
        knownPaths,
      }).catch(() => []);
      found.push([workspace.id, orphans]);
    }
    set((state) => {
      const next = { ...state.orphanWorktrees };
      for (const [workspaceId, orphans] of found) {
        next[workspaceId] = orphans;
      }
      return { orphanWorktrees: next };
    });
    for (const [workspaceId, orphans] of found) {
      if (orphans.length === 0) {
        continue;
      }
      await get().emitNotification(
        'orphan-worktrees',
        'info',
        `${orphans.length} session folders left on disk`,
        'They belong to no session any more. Review them in workspace settings and remove them when you want the space back.',
        { workspaceId, action: { kind: 'open-orphan-worktrees', workspaceId } },
      );
    }
  };
};
