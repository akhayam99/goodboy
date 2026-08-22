import type { WorkspaceId } from '@goodboy/types';
import { listProjectScripts } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const loadScripts = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const projects = get().projects.filter((project) => project.workspaceId === workspaceId);
    const scripts = (
      await Promise.all(
        projects.map((project) => listProjectScripts({ db: tauriDatabase, projectId: project.id })),
      )
    ).flat();
    set((state) => ({
      projectScripts: { ...state.projectScripts, [workspaceId]: scripts },
    }));
  };
};
