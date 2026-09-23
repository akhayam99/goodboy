import { updateSessionMountLifecycle } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { runMountRemoval } from '../project-mounts/runMountRemoval';
import { collectArchivedWorktrees } from './collectArchivedWorktrees';
import type { GetFn, SetFn, WorktreeRemovalResult } from './types';

export const removeArchivedWorktrees = (_set: SetFn, get: GetFn) => {
  return async (): Promise<WorktreeRemovalResult> => {
    const targets = await collectArchivedWorktrees({ projects: get().projects });
    let removed = 0;
    let failed = 0;
    for (const target of targets) {
      const result = await runMountRemoval({
        get,
        mode: 'safe',
        keepDirectory: false,
        finish: 'clear-path',
        expectedRevision: target.revision,
        target: {
          sessionId: target.sessionId,
          mountId: target.mountId,
          projectId: null,
          repoRoot: target.repoPath,
          worktreePath: target.worktreePath,
          branch: target.branch,
          diskState: 'present',
          isRepoProject: true,
        },
        finishRow: async ({ decision, diskState }) => {
          if (decision.kind === 'kept') {
            return true;
          }
          return updateSessionMountLifecycle({
            db: tauriDatabase,
            sessionId: target.sessionId,
            mountId: target.mountId,
            worktreePath: null,
            isAttached: false,
            diskState,
            expectedRevision: target.revision,
            updatedAt: new Date().toISOString() as IsoDateTime,
          });
        },
      }).catch(() => null);
      const kind = result?.decision.kind ?? 'failed';
      switch (kind) {
        case 'kept':
        case 'failed':
          failed += 1;
          continue;
        case 'removed':
        case 'missing':
          removed += 1;
          continue;
        default: {
          const exhaustive: never = kind;
          throw exhaustive;
        }
      }
    }
    await get().loadStorageStats();
    await get()
      .reconcileOrphanWorktrees()
      .catch(() => undefined);
    return { removed, failed };
  };
};
