import { formatError } from '@goodboy/ui';
import { parseUpdateNotes } from '../../../features/changelog/parseUpdateNotes';
import { prefetchReleaseImages } from '../../../features/changelog/prefetchReleaseImages';
import { progressFrom } from './downloadProgress';
import { getPendingUpdate } from './pendingUpdate';
import type { GetFn, SetFn } from './types';

export const downloadUpdate = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const update = getPendingUpdate();
    if (update === null) {
      return;
    }
    set({
      updaterStatus: 'downloading-bg',
      updateFailure: null,
      updateProgress: { downloaded: 0, total: null },
    });
    try {
      await update.download((event) => {
        const current = get().updateProgress ?? { downloaded: 0, total: null };
        set({ updateProgress: progressFrom({ event, current }) });
      });
      const notes = parseUpdateNotes({ version: update.version, body: update.body ?? '' });
      if (notes !== null) {
        prefetchReleaseImages({ release: notes });
      }
      set({ updaterStatus: 'ready', updateNotes: notes, updateProgress: null });
    } catch (err) {
      set({
        updaterStatus: 'available',
        updateProgress: null,
        updateFailure: { phase: 'download', message: formatError(err) },
      });
    }
  };
};
