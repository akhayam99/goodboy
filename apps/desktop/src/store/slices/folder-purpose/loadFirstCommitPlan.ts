import type { FirstCommitPlan } from '@goodboy/types';
import { firstCommitPlan } from '../../../shared/lib/folderGit';
import { projectById } from '../projects/projectIndex';
import type { FolderGitTargetParams, FolderSignalsDeps } from './types';

export const loadFirstCommitPlan = ({ set, get, latest }: FolderSignalsDeps) => {
  return async ({ projectId }: FolderGitTargetParams): Promise<FirstCommitPlan | null> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error('This folder is no longer in a workspace');
    }
    const outcome = await latest.run({
      key: `plan:${projectId}`,
      request: () => firstCommitPlan({ path: project.rootPath }),
      apply: (plan) =>
        set((state) => ({ firstCommitPlans: { ...state.firstCommitPlans, [projectId]: plan } })),
    });
    if (outcome === 'stale') {
      return null;
    }
    return get().firstCommitPlans[projectId] ?? null;
  };
};
