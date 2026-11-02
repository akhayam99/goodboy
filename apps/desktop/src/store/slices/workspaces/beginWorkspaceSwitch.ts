import type { WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly id: WorkspaceId | null;
};

export const beginWorkspaceSwitch = ({ set, id }: Params): void => {
  set({ switchingToWorkspaceId: id, workspaceSwitchError: null });
};
