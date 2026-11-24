import { getSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SliceDeps } from '../../slice-types';
import { parseUnavailableModels, SETTING_UNAVAILABLE_MODELS } from './unavailableModelsSetting';

export const hydrateUnavailableModels = ({ set }: SliceDeps) => {
  return async (): Promise<void> => {
    try {
      const raw = await getSetting(tauriDatabase, SETTING_UNAVAILABLE_MODELS);
      set({ unavailableModels: parseUnavailableModels({ raw }) });
    } catch {
      set({ unavailableModels: [] });
    }
  };
};
