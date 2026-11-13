import type { WorkspaceId } from '@goodboy/types';
import type { LaunchReads } from '../workspaces/launchReads';
import { openLaunchWorkspace } from './openLaunchWorkspace';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly id: WorkspaceId;
  readonly launch: LaunchReads;
};

type Opened = {
  readonly isLatest: boolean;
};

export const openWorkspaceOrFail = async ({ set, get, id, launch }: Params): Promise<Opened> => {
  const { isLatest, failure } = await openLaunchWorkspace({ set, get, id, launch });
  if (failure !== null) {
    throw new Error(failure);
  }
  return { isLatest };
};
