import { updateProjectAfterMerge as persistProjectAfterMerge } from '@goodboy/db';
import type { AfterMergeRule, ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';
import { projectById } from './projectIndex';

type Input = {
  readonly projectId: ProjectId;
  readonly afterMerge: AfterMergeRule | null;
};

export const updateProjectAfterMerge = (set: SetFn, get: GetFn) => {
  return async ({ projectId, afterMerge }: Input): Promise<void> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    await persistProjectAfterMerge({ db: tauriDatabase, projectId, afterMerge });
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId
          ? { ...candidate, overrides: { ...candidate.overrides, afterMerge } }
          : candidate,
      ),
    }));
  };
};
