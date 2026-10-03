import { listSettingsWithPrefix } from '@goodboy/db';
import { SCRIPT_PINS_PREFIX } from '../../../features/scripts/scriptPinsKey';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadScriptPins = (set: SetFn) => {
  return async (): Promise<void> => {
    const rows = await listSettingsWithPrefix(tauriDatabase, SCRIPT_PINS_PREFIX);
    if (rows.length === 0) {
      return;
    }
    set((state) => ({
      settings: {
        ...state.settings,
        ...Object.fromEntries(rows.map((row) => [row.key, row.value])),
      },
    }));
  };
};
