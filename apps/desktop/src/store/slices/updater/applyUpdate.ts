import { relaunch } from '@tauri-apps/plugin-process';
import type { DownloadEvent } from '@tauri-apps/plugin-updater';
import { formatError } from '@goodboy/ui';
import { getPendingUpdate } from './pendingUpdate';
import type { GetFn, SetFn } from './types';

const progressFrom = ({
  event,
  current,
}: {
  event: DownloadEvent;
  current: { downloaded: number; total: number | null };
}) => {
  switch (event.event) {
    case 'Started':
      return { downloaded: 0, total: event.data.contentLength ?? null };
    case 'Progress':
      return { ...current, downloaded: current.downloaded + event.data.chunkLength };
    case 'Finished':
      return { ...current, downloaded: current.total ?? current.downloaded };
    default: {
      const _exhaustive: never = event;
      return current;
    }
  }
};

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
        await relaunch();
      } catch (err) {
        set({
          updaterStatus: 'ready',
          updateFailure: { phase: 'install', message: formatError(err) },
        });
        void get().reportError({
          title: `Couldn't install ${update.version}`,
          error: err,
          action: { kind: 'retry-update' },
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
      await relaunch();
    } catch (err) {
      set({
        updaterStatus: 'available',
        updateProgress: null,
        updateFailure: { phase: 'install', message: formatError(err) },
      });
      void get().reportError({
        title: `Couldn't install ${update.version}`,
        error: err,
        action: { kind: 'retry-update' },
      });
    }
  };
};
