import { updateProjectBaseBranch as persistProjectBaseBranch } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';
import { projectById } from './projectIndex';

type Input = {
  readonly projectId: ProjectId;
  readonly baseBranch: string | null;
};

export const updateProjectBaseBranch = (set: SetFn, get: GetFn) => {
  return async ({ projectId, baseBranch }: Input): Promise<void> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    await persistProjectBaseBranch({ db: tauriDatabase, projectId, baseBranch });
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId ? { ...candidate, baseBranch } : candidate,
      ),
    }));
  };
};
