import { listSettingsWithPrefix } from '@goodboy/db';
import { AUTO_CHECKS_PREFIX } from '../../../features/scripts/autoChecksKey';
import { SCRIPT_PINS_PREFIX } from '../../../features/scripts/scriptPinsKey';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const loadScriptPins = (set: SetFn) => {
  return async (): Promise<void> => {
    const pins = await listSettingsWithPrefix(tauriDatabase, SCRIPT_PINS_PREFIX);
    const checks = await listSettingsWithPrefix(tauriDatabase, AUTO_CHECKS_PREFIX);
    const rows = [...pins, ...checks];
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
