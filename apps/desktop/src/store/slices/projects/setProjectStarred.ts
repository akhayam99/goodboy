import { updateProjectStar } from '@goodboy/db';
import type { IsoDateTime, ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly projectId: ProjectId;
  readonly isStarred: boolean;
};

export const setProjectStarred = (set: SetFn, get: GetFn) => {
  return async ({ projectId, isStarred }: Input): Promise<void> => {
    const project = get().projects.find((candidate) => candidate.id === projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    const starredAt = isStarred ? (new Date().toISOString() as IsoDateTime) : null;
    await updateProjectStar({ db: tauriDatabase, projectId, starredAt });
    set((state) => ({
      projects: state.projects.map((candidate) => {
        if (candidate.id !== projectId) {
          return candidate;
        }
        const { starredAt: _previous, ...rest } = candidate;
        return starredAt === null ? rest : { ...rest, starredAt };
      }),
    }));
  };
};
