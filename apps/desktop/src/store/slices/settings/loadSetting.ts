import { getSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadSetting = (set: SetFn) => {
  return async (key: string): Promise<string | null> => {
    const value = await getSetting(tauriDatabase, key);
    if (value === null) {
      return value;
    }
    set((state) =>
      state.settings[key] === value ? state : { settings: { ...state.settings, [key]: value } },
    );
    return value;
  };
};
