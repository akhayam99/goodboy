import type { WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type MarkParams = {
  readonly workspaceId: WorkspaceId;
};

export const markLeadPermissionsChanged =
  ({ set, get }: Params) =>
  ({ workspaceId }: MarkParams): number => {
    const next = (get().leadPermissionsRevisionByWorkspace[workspaceId] ?? 0) + 1;
    set((state) => ({
      leadPermissionsRevisionByWorkspace: {
        ...state.leadPermissionsRevisionByWorkspace,
        [workspaceId]: next,
      },
    }));
    return next;
  };
