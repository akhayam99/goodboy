import { insertDeletedBranch } from '@goodboy/db';
import type { DeletedBranch, IsoDateTime } from '@goodboy/types';
import {
  asBranchCleanupError,
  deleteBranchChecked,
} from '../../../features/worktree/branchCleanup';
import { tauriDatabase } from '../../../shared/lib/db';
import { keptBecauseOfError } from './keptBecause';
import type {
  DeleteBranchesOutcome,
  DeleteBranchesParams,
  GetFn,
  RestoreDeletedBranchesParams,
  SetFn,
} from './types';
import { projectById } from '../projects/projectIndex';

export const deleteBranches = (set: SetFn, get: GetFn) => {
  return async ({ targets }: DeleteBranchesParams): Promise<DeleteBranchesOutcome> => {
    const deleted: DeletedBranch[] = [];
    const kept: string[] = [];
    for (const target of targets) {
      const project = projectById(get().projects, target.projectId);
      if (project === undefined) {
        continue;
      }
      const outcome = await deleteBranchChecked({
        repoRoot: project.rootPath,
        branch: target.branch,
        expectedSha: target.sha,
        alsoOrigin: target.alsoOrigin,
      }).catch(
        (error: unknown) => asBranchCleanupError(error) ?? { kind: 'git' as const, message: '' },
      );
      if ('kind' in outcome) {
        kept.push(keptBecauseOfError({ branch: target.branch, error: outcome }));
        continue;
      }
      const entry: DeletedBranch = {
        id: crypto.randomUUID(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        sessionId: target.sessionId,
        repoRoot: project.rootPath,
        branch: target.branch,
        sha: target.sha,
        keepRef: outcome.keepRef,
        onOrigin: outcome.deletedOnOrigin,
        deletedAt: new Date().toISOString() as IsoDateTime,
        restoredAt: null,
      };
      await insertDeletedBranch({ db: tauriDatabase, entry });
      deleted.push(entry);
      if (target.sessionId !== null) {
        await get()
          .recordSessionEvent({
            sessionId: target.sessionId,
            kind: 'branch_deleted',
            payload: {
              branch: target.branch,
              projectId: project.id,
              projectName: project.name,
              deletedBranchId: entry.id,
              onOrigin: outcome.deletedOnOrigin,
            },
          })
          .catch(() => undefined);
      }
    }
    set((state) => {
      const next = { ...state.deletedBranches };
      for (const entry of deleted) {
        next[entry.workspaceId] = [entry, ...(next[entry.workspaceId] ?? [])];
      }
      return { deletedBranches: next };
    });
    const projectIds = [...new Set(targets.map((target) => target.projectId))];
    await get().loadProjectBranches({ projectIds });
    return { deleted, kept };
  };
};

export const restoreDeletedBranches = (_set: SetFn, get: GetFn) => {
  return async ({ ids }: RestoreDeletedBranchesParams): Promise<void> => {
    const projectIds = new Set(
      Object.values(get().deletedBranches)
        .flat()
        .filter((entry) => ids.includes(entry.id))
        .map((entry) => entry.projectId),
    );
    for (const id of ids) {
      await get().restoreDeletedBranch({ id });
    }
    await get().loadProjectBranches({ projectIds: [...projectIds] });
  };
};
