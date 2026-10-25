import { setSetting as dbSetSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { announceDataChanged } from '../../../shared/lib/dataChanged';
import type { GetFn, SetFn } from './types';

export const saveSetting = (set: SetFn, get: GetFn) => {
  return async (key: string, value: string) => {
    await dbSetSetting(tauriDatabase, key, value);
    set((state) => ({ settings: { ...state.settings, [key]: value } }));
    announceDataChanged({ change: { kind: 'setting', key } }).catch((error: unknown) =>
      get().reportError({
        title: "Couldn't tell the other windows about a saved setting",
        error,
        severity: 'warning',
      }),
    );
  };
};
