import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import { renameWorkspace as renameWorkspaceRow } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly name: string;
};

export const renameWorkspace = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, name }: Input): Promise<Workspace> => {
    const workspace = get().workspaces.find((candidate) => candidate.id === workspaceId);
    if (workspace == null) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }
    const trimmed = name.trim();
    if (trimmed === '') {
      throw new Error('give the workspace a name');
    }
    if (trimmed === workspace.name) {
      return workspace;
    }

    await renameWorkspaceRow(tauriDatabase, workspaceId, trimmed);

    const renamed: Workspace = {
      ...workspace,
      name: trimmed,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    set((state) => ({
      workspaces: state.workspaces.map((candidate) =>
        candidate.id === workspaceId ? renamed : candidate,
      ),
    }));
    return renamed;
  };
};
