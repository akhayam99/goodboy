import { getWorkspaceValue, type WorkspaceValueKey } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly key: WorkspaceValueKey;
};

type Deps = {
  readonly set: SetFn;
};

export const loadWorkspaceValue = ({ set }: Deps) => {
  return async ({ workspaceId, key }: Params): Promise<string | null> => {
    const value = await getWorkspaceValue({ db: tauriDatabase, workspaceId, key });
    if (value === null) {
      return value;
    }
    set((state) => {
      const held = state.workspaceValues[workspaceId] ?? {};
      if (held[key] === value) {
        return state;
      }
      return {
        workspaceValues: { ...state.workspaceValues, [workspaceId]: { ...held, [key]: value } },
      };
    });
    return value;
  };
};
