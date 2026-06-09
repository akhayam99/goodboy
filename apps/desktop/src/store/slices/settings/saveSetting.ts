import { setSetting as dbSetSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const saveSetting = (set: SetFn) => {
  return async (key: string, value: string) => {
    await dbSetSetting(tauriDatabase, key, value);
    set((state) => ({ settings: { ...state.settings, [key]: value } }));
  };
};
