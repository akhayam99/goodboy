import { formatError } from '@goodboy/ui';
import { getPendingUpdate } from './pendingUpdate';
import { progressFrom } from './downloadProgress';
import { relaunchWithResume } from './prepareRestart';
import type { GetFn, SetFn } from './types';

export const applyUpdate = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const update = getPendingUpdate();
    if (update === null) {
      return;
    }
    const wasReady = get().updaterStatus === 'ready';
    if (wasReady) {
      set({ updaterStatus: 'downloading', updateFailure: null });
      try {
        await update.install();
        await relaunchWithResume({ reason: 'update' });
      } catch (err) {
        set({
          updaterStatus: 'ready',
          updateFailure: { phase: 'install', message: formatError(err) },
        });
        void get().reportError({
          title: `Couldn't install ${update.version}`,
          error: err,
          recovery: { action: { kind: 'retry-update' } },
        });
      }
      return;
    }
    set({
      updaterStatus: 'downloading',
      updateFailure: null,
      updateProgress: { downloaded: 0, total: null },
    });
    try {
      await update.downloadAndInstall((event) => {
        const current = get().updateProgress ?? { downloaded: 0, total: null };
        set({ updateProgress: progressFrom({ event, current }) });
      });
      await relaunchWithResume({ reason: 'update' });
    } catch (err) {
      set({
        updaterStatus: 'available',
        updateProgress: null,
        updateFailure: { phase: 'install', message: formatError(err) },
      });
      void get().reportError({
        title: `Couldn't install ${update.version}`,
        error: err,
        recovery: { action: { kind: 'retry-update' } },
      });
    }
  };
};
