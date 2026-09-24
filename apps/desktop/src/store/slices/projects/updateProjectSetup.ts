import { updateProjectSetup as persistProjectSetup, type ProjectSetupInput } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly projectId: ProjectId;
  readonly setup: ProjectSetupInput;
};

export const updateProjectSetup = (set: SetFn, get: GetFn) => {
  return async ({ projectId, setup }: Input): Promise<void> => {
    const project = get().projects.find((candidate) => candidate.id === projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    const stored = await persistProjectSetup({ db: tauriDatabase, projectId, setup });
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId ? { ...candidate, setup: stored ?? undefined } : candidate,
      ),
    }));
  };
};
