import type { WorkspaceId } from '@goodboy/types';
import type { LaunchReads } from '../workspaces/launchReads';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly id: WorkspaceId;
  readonly launch: LaunchReads;
};

export const openWorkspaceOrFail = async ({ get, id, launch }: Params): Promise<void> => {
  await get().setCurrentWorkspace(id, launch);
  const failure = get().workspaceSwitchError;
  if (failure !== null && failure.workspaceId === id) {
    throw new Error(failure.message);
  }
};
