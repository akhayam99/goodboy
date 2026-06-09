import { check } from '@tauri-apps/plugin-updater';
import { formatError } from '../../../shared/lib/errors';
import { setPendingUpdate } from './pendingUpdate';
import type { GetFn, SetFn } from './types';

export const checkForUpdates = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    set({ updaterStatus: 'checking', updateError: null });
    try {
      const update = await check();
      if (update) {
        setPendingUpdate(update);
        set({ updaterStatus: 'available', updateVersion: update.version });
      } else {
        setPendingUpdate(null);
        set({ updaterStatus: 'uptodate', updateVersion: null });
      }
    } catch (err) {
      setPendingUpdate(null);
      set({ updaterStatus: 'error', updateError: formatError(err) });
    }
  };
};
