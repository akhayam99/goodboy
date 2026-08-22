import { listIntegrationsForWorkspace } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const loadIntegrations = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId) => {
    const projects = get().projects.filter((project) => project.workspaceId === workspaceId);
    const rows = (
      await Promise.all(
        projects.map((project) => listIntegrationsForWorkspace(tauriDatabase, project.id)),
      )
    ).flat();
    set((state) => ({
      workspaceIntegrations: { ...state.workspaceIntegrations, [workspaceId]: rows },
    }));
  };
};
