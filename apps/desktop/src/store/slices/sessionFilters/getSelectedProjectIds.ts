import type { GetSelectedProjectIdsParams } from './types';
import type { GetFn, SetFn } from '../../slice-types';
import { readFromStorage } from './storage';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const getSelectedProjectIds =
  ({ set, get }: Params) =>
  ({ workspaceId }: GetSelectedProjectIdsParams): ReadonlyArray<string> => {
    const cached = get().selectedProjectIds[workspaceId];
    if (cached !== undefined) {
      return cached;
    }
    const selectedProjectIds = readFromStorage({ workspaceId });
    set((state) => ({
      selectedProjectIds: { ...state.selectedProjectIds, [workspaceId]: selectedProjectIds },
    }));
    return selectedProjectIds;
  };
