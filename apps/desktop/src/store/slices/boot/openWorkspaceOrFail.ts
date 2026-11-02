import type { WorkspaceId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly id: WorkspaceId;
};

export const openWorkspaceOrFail = async ({ get, id }: Params): Promise<void> => {
  await get().setCurrentWorkspace(id);
  const failure = get().workspaceSwitchError;
  if (failure !== null && failure.workspaceId === id) {
    throw new Error(failure.message);
  }
};
