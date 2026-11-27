import { setWorkspaceValue, type WorkspaceValueKey } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { announceWorkspaceChange } from './announceWorkspaceChange';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly key: Extract<WorkspaceValueKey, 'home.layout'>;
  readonly value: string;
};

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const saveWorkspaceValue = ({ set, get }: Deps) => {
  return async ({ workspaceId, key, value }: Params): Promise<void> => {
    await setWorkspaceValue({ db: tauriDatabase, workspaceId, key, value });
    set((state) => ({
      workspaceValues: {
        ...state.workspaceValues,
        [workspaceId]: { ...state.workspaceValues[workspaceId], [key]: value },
      },
    }));
    announceWorkspaceChange({ get, workspaceId, key });
  };
};
