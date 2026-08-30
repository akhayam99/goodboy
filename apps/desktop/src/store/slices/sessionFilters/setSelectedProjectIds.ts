import type { SetSelectedProjectIdsParams } from './types';
import type { SetFn } from '../../slice-types';
import { writeToStorage } from './storage';

type Params = {
  readonly set: SetFn;
};

export const setSelectedProjectIds =
  ({ set }: Params) =>
  ({ workspaceId, selectedProjectIds }: SetSelectedProjectIdsParams): void => {
    const uniqueIds = [...new Set(selectedProjectIds)];
    writeToStorage({ workspaceId, selectedProjectIds: uniqueIds });
    set((state) => ({
      selectedProjectIds: { ...state.selectedProjectIds, [workspaceId]: uniqueIds },
    }));
  };
