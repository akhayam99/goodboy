import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import { listAllProjectsForWorkspace, reconnectWorkspaceAndProjects } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const reconnectWorkspaceById = (set: SetFn, get: GetFn) => {
  return async (id: WorkspaceId): Promise<void> => {
    const workspace = get().disconnectedWorkspaces.find((candidate) => candidate.id === id);
    if (workspace === undefined) {
      return;
    }
    const now = new Date().toISOString() as IsoDateTime;
    const projects = await listAllProjectsForWorkspace({ db: tauriDatabase, workspaceId: id });
    await reconnectWorkspaceAndProjects({
      db: tauriDatabase,
      id,
      projectIds: projects.map((project) => project.id),
      at: now,
    });
    const reconnectedWorkspace = {
      ...workspace,
      disconnectedAt: undefined,
      updatedAt: now,
      lastAccessedAt: now,
    };
    const reconnectedProjects = projects.map((project) => ({
      ...project,
      disconnectedAt: undefined,
      updatedAt: now,
      lastAccessedAt: now,
    }));
    set((state) => ({
      disconnectedWorkspaces: state.disconnectedWorkspaces.filter(
        (candidate) => candidate.id !== id,
      ),
      workspaces: [reconnectedWorkspace, ...state.workspaces],
      projects: [
        ...reconnectedProjects,
        ...state.projects.filter(
          (project) => !reconnectedProjects.some((reconnected) => reconnected.id === project.id),
        ),
      ],
    }));
  };
};
