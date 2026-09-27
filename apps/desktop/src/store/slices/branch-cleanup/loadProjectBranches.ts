import { listGoodboyBranches, listMergedRequestHeads } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { listProjectBranches } from '../../../features/worktree/branchCleanup';
import { tauriDatabase } from '../../../shared/lib/db';
import type { BranchScanEntry } from './state';
import type { GetFn, LoadProjectBranchesParams, SetFn } from './types';

const put = (set: SetFn, projectId: ProjectId, entry: BranchScanEntry): void =>
  set((state) => ({ branchScans: { ...state.branchScans, [projectId]: entry } }));

export const loadProjectBranches = (set: SetFn, get: GetFn) => {
  return async ({ projectIds }: LoadProjectBranchesParams): Promise<void> => {
    const projects = get().projects.filter(
      (project) => projectIds.includes(project.id) && project.kind === 'repo',
    );
    await Promise.all(
      projects.map(async (project) => {
        put(set, project.id, { status: 'loading' });
        try {
          const [mergedHeads, goodboy] = await Promise.all([
            listMergedRequestHeads({ db: tauriDatabase, projectId: project.id }),
            listGoodboyBranches({ db: tauriDatabase, projectId: project.id }),
          ]);
          const scan = await listProjectBranches({
            repoRoot: project.rootPath,
            base: project.baseBranch ?? null,
            mergedHeads,
          });
          put(set, project.id, { status: 'ready', scan, goodboy });
        } catch (error) {
          put(set, project.id, { status: 'failed', message: formatError(error) });
        }
      }),
    );
  };
};
