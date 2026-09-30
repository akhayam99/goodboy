import type { IsoDateTime, ProjectId } from '@goodboy/types';
import { disconnectProject } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';
import { projectById } from './projectIndex';

type Input = {
  readonly projectId: ProjectId;
};

export const removeProject = (set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<void> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    const at = new Date().toISOString() as IsoDateTime;
    await disconnectProject({ db: tauriDatabase, id: projectId, at });
    set((state) => {
      const projectGitStatus = { ...state.projectGitStatus };
      const projectCheckoutPulling = { ...state.projectCheckoutPulling };
      const projectFetchedAt = { ...state.projectFetchedAt };
      const projectCheckoutResult = { ...state.projectCheckoutResult };
      delete projectGitStatus[projectId];
      delete projectCheckoutPulling[projectId];
      delete projectFetchedAt[projectId];
      delete projectCheckoutResult[projectId];
      return {
        projects: state.projects.filter((candidate) => candidate.id !== projectId),
        projectGitStatus,
        projectCheckoutPulling,
        projectFetchedAt,
        projectCheckoutResult,
      };
    });
  };
};
