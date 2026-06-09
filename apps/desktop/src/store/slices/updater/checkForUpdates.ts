import { check } from '@tauri-apps/plugin-updater';
import { formatError } from '../../../shared/lib/errors';
import { setPendingUpdate } from './pendingUpdate';
import type { GetFn, SetFn } from './types';

// Asks the configured endpoint whether a newer release exists. Stores the live
// Update handle in module scope and reflects the outcome in the store so the
// status bar and sidebar can surface it.
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
