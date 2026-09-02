import type { IsoDateTime, ProjectId, WorkspaceId } from '@goodboy/types';
import {
  describeProjectAdoption,
  getProjectById,
  moveProjectToWorkspace,
  reconnectProject,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly projectId: ProjectId;
  readonly targetWorkspaceId: WorkspaceId;
};

export type AdoptProjectResult = {
  readonly movedSessionCount: number;
  readonly ambiguousSessionCount: number;
  readonly mergedWorkspace: boolean;
};

export const adoptProject = (set: SetFn, get: GetFn) => {
  return async ({ projectId, targetWorkspaceId }: Input): Promise<AdoptProjectResult> => {
    const state = get();
    const project =
      state.projects.find((entry) => entry.id === projectId) ??
      (await getProjectById({ db: tauriDatabase, id: projectId }));
    if (project === null || project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    const target = state.workspaces.find((workspace) => workspace.id === targetWorkspaceId);
    if (target === undefined) {
      throw new Error(`workspace not found: ${targetWorkspaceId}`);
    }
    if (project.workspaceId === targetWorkspaceId) {
      return { movedSessionCount: 0, ambiguousSessionCount: 0, mergedWorkspace: false };
    }
    const info = await describeProjectAdoption({ db: tauriDatabase, projectId });
    if (info === null) {
      throw new Error(`project not found: ${projectId}`);
    }

    const reconnectIfNeeded = async () => {
      if (project.disconnectedAt === undefined) {
        return;
      }
      const at = new Date().toISOString() as IsoDateTime;
      await reconnectProject({ db: tauriDatabase, id: projectId, at });
      set((current) => ({
        projects: current.projects.map((entry) =>
          entry.id === projectId
            ? { ...entry, disconnectedAt: undefined, updatedAt: at, lastAccessedAt: at }
            : entry,
        ),
      }));
    };

    if (info.isShell) {
      await get().mergeWorkspaces({
        sourceWorkspaceIds: [info.sourceWorkspaceId],
        targetWorkspaceId,
      });
      await reconnectIfNeeded();
      return {
        movedSessionCount: info.sessionCount,
        ambiguousSessionCount: 0,
        mergedWorkspace: true,
      };
    }

    const result = await moveProjectToWorkspace({
      db: tauriDatabase,
      projectId,
      targetWorkspaceId,
    });
    set((current) => ({
      projects: current.projects.some((entry) => entry.id === projectId)
        ? current.projects.map((entry) =>
            entry.id === projectId ? { ...entry, workspaceId: targetWorkspaceId } : entry,
          )
        : [...current.projects, { ...project, workspaceId: targetWorkspaceId }],
    }));
    await reconnectIfNeeded();
    if (get().currentWorkspaceId === targetWorkspaceId) {
      await get().setCurrentWorkspace(targetWorkspaceId);
    }
    return { ...result, mergedWorkspace: false };
  };
};
