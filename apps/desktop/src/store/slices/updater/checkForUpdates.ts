import { check } from '@tauri-apps/plugin-updater';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import { getPendingUpdate, setPendingUpdate } from './pendingUpdate';
import type { GetFn, SetFn } from './types';

export const checkForUpdates = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    set({ updaterStatus: 'checking' });
    try {
      const update = await check();
      const checkedAt = new Date().toISOString() as IsoDateTime;
      if (update === null) {
        setPendingUpdate(null);
        set({
          updaterStatus: 'uptodate',
          updateVersion: null,
          updateFailure: null,
          updateCheckedAt: checkedAt,
        });
        return;
      }
      setPendingUpdate(update);
      set({
        updaterStatus: 'available',
        updateVersion: update.version,
        updateFailure: null,
        updateCheckedAt: checkedAt,
      });
    } catch (err) {
      const hasPending = getPendingUpdate() !== null;
      set({
        updaterStatus: hasPending ? 'available' : 'error',
        updateFailure: { phase: 'check', message: formatError(err) },
      });
    }
  };
};
