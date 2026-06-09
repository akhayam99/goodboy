import { relaunch } from '@tauri-apps/plugin-process';
import { formatError } from '../../../shared/lib/errors';
import { getPendingUpdate } from './pendingUpdate';
import type { GetFn, SetFn } from './types';

// Downloads + installs the pending update, then relaunches into the new
// version. On success the process is replaced, so nothing runs after relaunch.
export const installUpdate = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    const update = getPendingUpdate();
    if (!update) return;
    set({ updaterStatus: 'downloading', updateError: null });
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (err) {
      set({ updaterStatus: 'error', updateError: formatError(err) });
    }
  };
};
