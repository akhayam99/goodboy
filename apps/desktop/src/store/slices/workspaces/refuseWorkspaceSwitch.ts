import { CHECK_STATE } from '../notifications/errorRecovery';
import type { WorkspaceId } from '@goodboy/types';
import { failWorkspaceSwitch } from './failWorkspaceSwitch';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly id: WorkspaceId | null;
};

const STILL_RUNNING_MESSAGE =
  'An agent did not stop, so you stayed here, where you can still stop it. Then switch again.';

export const refuseWorkspaceSwitch = ({ set, get, id }: Params): void => {
  void get().reportError({
    recovery: CHECK_STATE,
    title: "Couldn't leave this workspace",
    error: new Error(STILL_RUNNING_MESSAGE),
    severity: 'warning',
  });
  if (id === null) {
    set({ switchingToWorkspaceId: null });
    return;
  }
  failWorkspaceSwitch({ set, id, message: STILL_RUNNING_MESSAGE });
};
