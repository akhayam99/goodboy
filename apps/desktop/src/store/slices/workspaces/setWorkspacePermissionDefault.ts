import type { ClaudePermissionMode, IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import { setWorkspacePermissionDefault as setWorkspacePermissionDefaultRow } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly mode: ClaudePermissionMode;
};

export const setWorkspacePermissionDefault = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, mode }: Input): Promise<Workspace> => {
    const workspace = get().workspaces.find((candidate) => candidate.id === workspaceId);
    if (workspace == null) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }
    if ((workspace.defaultPermissionMode ?? 'bypassPermissions') === mode) {
      return workspace;
    }

    await setWorkspacePermissionDefaultRow({ db: tauriDatabase, id: workspaceId, mode });

    const updated: Workspace = {
      ...workspace,
      defaultPermissionMode: mode,
      updatedAt: new Date().toISOString() as IsoDateTime,
    };
    set((state) => ({
      workspaces: state.workspaces.map((candidate) =>
        candidate.id === workspaceId ? updated : candidate,
      ),
    }));
    return updated;
  };
};
