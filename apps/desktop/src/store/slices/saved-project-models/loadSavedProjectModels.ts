import { listSettingsWithPrefix } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../state-writes/latestOnly';
import { parseSavedProjectModels } from './parseSavedProjectModels';
import { SAVED_PROJECT_MODELS_PREFIX, projectIdOfSavedKey } from './savedProjectModelsKey';
import type { SavedProjectModels } from './state';
import type { SetFn } from './types';

export const SAVED_PROJECT_MODELS_LATEST = 'saved-project-models';

export type SavedModelsLatest = ReturnType<typeof createLatestOnly>;

type Params = {
  readonly set: SetFn;
  readonly latest: SavedModelsLatest;
};

export const loadSavedProjectModels = ({ set, latest }: Params) => {
  return async (): Promise<void> => {
    await latest.run({
      key: SAVED_PROJECT_MODELS_LATEST,
      request: () => listSettingsWithPrefix(tauriDatabase, SAVED_PROJECT_MODELS_PREFIX),
      apply: (rows) => {
        const saved: Record<string, SavedProjectModels> = {};
        for (const row of rows) {
          const projectId = projectIdOfSavedKey({ key: row.key });
          const models = parseSavedProjectModels({ raw: row.value });
          if (projectId !== null && models !== null) {
            saved[projectId] = models;
          }
        }
        set({ savedProjectModels: saved });
      },
    });
  };
};
