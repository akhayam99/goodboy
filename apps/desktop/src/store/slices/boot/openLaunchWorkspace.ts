import type { WorkspaceId } from '@goodboy/types';
import type { LaunchReads } from '../workspaces/launchReads';
import { switchEpoch } from '../workspaces/switchEpoch';
import { showLaunchShell } from './showLaunchShell';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly id: WorkspaceId;
  readonly launch: LaunchReads;
};

type LaunchOpen = {
  readonly isLatest: boolean;
  readonly failure: string | null;
};

export const openLaunchWorkspace = async ({
  set,
  get,
  id,
  launch,
}: Params): Promise<LaunchOpen> => {
  showLaunchShell({ set, id });
  const opening = get().setCurrentWorkspace(id, launch);
  const epoch = switchEpoch.value;
  await opening;
  const isLatest = switchEpoch.value === epoch;
  const switchError = get().workspaceSwitchError;
  const failure =
    switchError !== null && switchError.workspaceId === id ? switchError.message : null;
  if (!get().boardReady && get().switchingToWorkspaceId === null) {
    set({ currentWorkspaceId: null, boardReady: true, isShellReady: false });
  }
  return { isLatest, failure };
};
