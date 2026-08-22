import type { Workspace, WorkspaceId, WorkspaceProfile } from '@goodboy/types';
import { upsertWorkspaceProfile } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly profile: WorkspaceProfile;
};

export const updateWorkspaceProfile = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, profile }: Input): Promise<Workspace> => {
    const workspace = get().workspaces.find((candidate) => candidate.id === workspaceId);
    if (workspace === undefined) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }
    await upsertWorkspaceProfile({ db: tauriDatabase, workspaceId, profile });
    const updated: Workspace = { ...workspace, profile };
    set((state) => ({
      workspaces: state.workspaces.map((candidate) =>
        candidate.id === workspaceId ? updated : candidate,
      ),
    }));
    return updated;
  };
};
