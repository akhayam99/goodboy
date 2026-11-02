import type { WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly id: WorkspaceId;
  readonly message: string;
};

export const failWorkspaceSwitch = ({ set, id, message }: Params): void => {
  set({ switchingToWorkspaceId: null, workspaceSwitchError: { workspaceId: id, message } });
};
