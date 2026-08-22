import type { Workspace, WorkspaceId } from '@goodboy/types';
import { updateWorkspaceSessionsRoot } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
};

export const adoptWorkspaceSessionsRoot = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, rootPath }: Input): Promise<Workspace> => {
    const workspace = get().workspaces.find((candidate) => candidate.id === workspaceId);
    if (workspace === undefined) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }
    if (workspace.sessionsRoot != null && workspace.sessionsRoot !== '') {
      return workspace;
    }
    await updateWorkspaceSessionsRoot({
      db: tauriDatabase,
      id: workspaceId,
      sessionsRoot: rootPath,
    });
    const updated: Workspace = { ...workspace, sessionsRoot: rootPath };
    set((state) => ({
      workspaces: state.workspaces.map((candidate) =>
        candidate.id === workspaceId ? updated : candidate,
      ),
    }));
    return updated;
  };
};
