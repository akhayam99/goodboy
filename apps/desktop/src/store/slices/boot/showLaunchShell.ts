import type { WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly id: WorkspaceId;
};

export const showLaunchShell = ({ set, id }: Params): void => {
  set({
    currentWorkspaceId: id,
    switchingToWorkspaceId: null,
    boardReady: false,
    isShellReady: true,
  });
};
