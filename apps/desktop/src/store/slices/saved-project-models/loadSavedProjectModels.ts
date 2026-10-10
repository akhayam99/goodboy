import { listSettingsWithPrefix } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { parseSavedProjectModels } from './parseSavedProjectModels';
import { SAVED_PROJECT_MODELS_PREFIX, projectIdOfSavedKey } from './savedProjectModelsKey';
import type { SavedProjectModels } from './state';
import type { SetFn } from './types';

export const loadSavedProjectModels = (set: SetFn) => {
  return async (): Promise<void> => {
    const rows = await listSettingsWithPrefix(tauriDatabase, SAVED_PROJECT_MODELS_PREFIX);
    const saved: Record<string, SavedProjectModels> = {};
    for (const row of rows) {
      const projectId = projectIdOfSavedKey({ key: row.key });
      const models = parseSavedProjectModels({ raw: row.value });
      if (projectId !== null && models !== null) {
        saved[projectId] = models;
      }
    }
    set({ savedProjectModels: saved });
  };
};
