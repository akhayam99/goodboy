import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { discardSavedProjectModels } from './discardSavedProjectModels';
import type { SavedModelsLatest } from './loadSavedProjectModels';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly projectId: ProjectId;
  readonly workspaceId: WorkspaceId;
};

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly latest: SavedModelsLatest;
};

export const applySavedProjectModels = ({ set, get, latest }: Deps) => {
  return async ({ projectId, workspaceId }: Params): Promise<void> => {
    const saved = get().savedProjectModels[projectId];
    if (saved === undefined) {
      throw new Error(`no saved model settings for project: ${projectId}`);
    }
    const base = get().workspaceOverrides[workspaceId];
    const taskModels = { ...base?.taskModels, ...saved.taskModels };
    const roleModels = { ...base?.roleModels, ...saved.roleModels };
    await get().patchWorkspaceOverrides({
      workspaceId,
      patch: {
        taskModels: Object.keys(taskModels).length > 0 ? taskModels : null,
        roleModels: Object.keys(roleModels).length > 0 ? roleModels : null,
      },
    });
    await discardSavedProjectModels({ set, latest })({ projectId });
  };
};
