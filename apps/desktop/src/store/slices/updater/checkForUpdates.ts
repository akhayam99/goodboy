import { check } from '@tauri-apps/plugin-updater';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime } from '@goodboy/types';
import { SETTING_UPDATER_AUTO_DOWNLOAD } from '../../../features/settings/settings';
import { getPendingUpdate, setPendingUpdate } from './pendingUpdate';
import type { UpdaterState } from './state';
import type { GetFn, SetFn } from './types';

const HELD_STATUSES: ReadonlySet<UpdaterState['updaterStatus']> = new Set([
  'downloading-bg',
  'ready',
  'downloading',
]);

let latestCheck = 0;

export const checkForUpdates = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    latestCheck += 1;
    const checkId = latestCheck;
    const isHeld = (): boolean => HELD_STATUSES.has(get().updaterStatus);
    if (!isHeld()) {
      set({ updaterStatus: 'checking' });
    }
    try {
      const update = await check();
      if (checkId !== latestCheck) {
        return;
      }
      const checkedAt = new Date().toISOString() as IsoDateTime;
      if (update !== null && getPendingUpdate()?.version === update.version && isHeld()) {
        set({ updateCheckedAt: checkedAt });
        return;
      }
      if (update === null) {
        setPendingUpdate(null);
        set({
          updaterStatus: 'uptodate',
          updateVersion: null,
          updateNotes: null,
          updateFailure: null,
          updateCheckedAt: checkedAt,
        });
        return;
      }
      setPendingUpdate(update);
      set({
        updaterStatus: 'available',
        updateVersion: update.version,
        updateNotes: null,
        updateFailure: null,
        updateCheckedAt: checkedAt,
      });
      void get().loadChangelogUpcoming({ target: update.version });
      const autoDownload = await get().loadSetting(SETTING_UPDATER_AUTO_DOWNLOAD);
      if (autoDownload !== 'false') {
        void get().downloadUpdate();
      }
    } catch (err) {
      if (checkId !== latestCheck || isHeld()) {
        return;
      }
      const hasPending = getPendingUpdate() !== null;
      set({
        updaterStatus: hasPending ? 'available' : 'error',
        updateFailure: { phase: 'check', message: formatError(err) },
      });
    }
  };
};
