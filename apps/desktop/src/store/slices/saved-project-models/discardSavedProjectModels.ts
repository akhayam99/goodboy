import { deleteSetting } from '@goodboy/db';
import type { ProjectId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { SAVED_PROJECT_MODELS_LATEST, type SavedModelsLatest } from './loadSavedProjectModels';
import { savedProjectModelsKey } from './savedProjectModelsKey';
import type { SetFn } from './types';

type Params = {
  readonly projectId: ProjectId;
};

type Deps = {
  readonly set: SetFn;
  readonly latest: SavedModelsLatest;
};

export const discardSavedProjectModels = ({ set, latest }: Deps) => {
  return async ({ projectId }: Params): Promise<void> => {
    latest.cancel({ key: SAVED_PROJECT_MODELS_LATEST });
    await deleteSetting(tauriDatabase, savedProjectModelsKey({ projectId }));
    set((state) => ({
      savedProjectModels: Object.fromEntries(
        Object.entries(state.savedProjectModels).filter(([id]) => id !== projectId),
      ),
    }));
  };
};
