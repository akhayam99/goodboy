import { updateProjectDescription } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly projectId: ProjectId;
  readonly description: string;
};

export const describeProject = (set: SetFn, get: GetFn) => {
  return async ({ projectId, description }: Input): Promise<void> => {
    const project = get().projects.find((candidate) => candidate.id === projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    const trimmed = description.replace(/\s+/g, ' ').trim();
    const next = trimmed === '' ? null : trimmed;
    await updateProjectDescription({ db: tauriDatabase, projectId, description: next });
    set((state) => ({
      projects: state.projects.map((candidate) =>
        candidate.id === projectId ? { ...candidate, description: next } : candidate,
      ),
    }));
  };
};
