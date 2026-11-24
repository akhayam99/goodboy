import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SliceDeps } from '../../slice-types';
import { isSameUnavailableModel } from './isSameUnavailableModel';
import { SETTING_UNAVAILABLE_MODELS, type UnavailableModel } from './unavailableModelsSetting';

export const clearModelUnavailable = ({ set, get }: SliceDeps) => {
  return async ({ providerId, accountId, modelKey }: UnavailableModel): Promise<void> => {
    const model = { providerId, accountId, modelKey };
    const current = get().unavailableModels;
    if (!current.some((entry) => isSameUnavailableModel({ entry, model }))) {
      return;
    }
    const next = current.filter((entry) => !isSameUnavailableModel({ entry, model }));
    await setSetting(tauriDatabase, SETTING_UNAVAILABLE_MODELS, JSON.stringify(next));
    set((state) => ({
      unavailableModels: state.unavailableModels.filter(
        (entry) => !isSameUnavailableModel({ entry, model }),
      ),
    }));
  };
};
