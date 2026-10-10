import { clearProjectModelOverrides as persistClearedModelOverrides } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';
import { projectById } from './projectIndex';

type Input = {
  readonly projectId: ProjectId;
};

export const clearProjectModelOverrides = (set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<void> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    await persistClearedModelOverrides({ db: tauriDatabase, id: projectId });
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId
          ? {
              ...candidate,
              overrides: {
                ...candidate.overrides,
                defaultProviderId: null,
                taskModels: null,
                roleModels: null,
                providerPool: null,
              },
            }
          : candidate,
      ),
    }));
  };
};
