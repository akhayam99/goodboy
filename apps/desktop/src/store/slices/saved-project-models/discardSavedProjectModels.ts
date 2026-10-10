import { deleteSetting } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { savedProjectModelsKey } from './savedProjectModelsKey';
import type { SetFn } from './types';

type Params = {
  readonly projectId: ProjectId;
};

export const discardSavedProjectModels = (set: SetFn) => {
  return async ({ projectId }: Params): Promise<void> => {
    await deleteSetting(tauriDatabase, savedProjectModelsKey({ projectId }));
    set((state) => ({
      savedProjectModels: Object.fromEntries(
        Object.entries(state.savedProjectModels).filter(([id]) => id !== projectId),
      ),
    }));
  };
};
