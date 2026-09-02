import type { WorkspaceId } from '@goodboy/types';
import { mergeWorkspaces as mergeWorkspacesInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly sourceWorkspaceIds: ReadonlyArray<WorkspaceId>;
  readonly targetWorkspaceId: WorkspaceId;
};

export const mergeWorkspaces = (set: SetFn, get: GetFn) => {
  return async ({ sourceWorkspaceIds, targetWorkspaceId }: Input): Promise<void> => {
    const state = get();
    const target = state.workspaces.find((workspace) => workspace.id === targetWorkspaceId);
    if (target === undefined) {
      throw new Error(`workspace not found: ${targetWorkspaceId}`);
    }
    const sources = sourceWorkspaceIds.filter((id) => id !== targetWorkspaceId);
    if (sources.length === 0) {
      return;
    }

    await mergeWorkspacesInDb({
      db: tauriDatabase,
      sourceWorkspaceIds: sources,
      targetWorkspaceId,
    });

    const sourceSet = new Set<WorkspaceId>(sources);
    set((current) => {
      const archivedSessions = { ...current.archivedSessions };
      const workspaceIntegrations = { ...current.workspaceIntegrations };
      const projectScripts = { ...current.projectScripts };
      const workspaceOverrides = { ...current.workspaceOverrides };
      for (const id of sources) {
        delete archivedSessions[id];
        delete workspaceIntegrations[id];
        delete projectScripts[id];
        delete workspaceOverrides[id];
      }
      return {
        workspaces: current.workspaces.filter((workspace) => !sourceSet.has(workspace.id)),
        projects: current.projects.map((project) =>
          sourceSet.has(project.workspaceId)
            ? { ...project, workspaceId: targetWorkspaceId }
            : project,
        ),
        archivedSessions,
        workspaceIntegrations,
        projectScripts,
        workspaceOverrides,
      };
    });

    if (state.currentWorkspaceId === targetWorkspaceId) {
      await get().setCurrentWorkspace(targetWorkspaceId);
    }
  };
};
