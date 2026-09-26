import { formatError } from '@goodboy/ui';
import { parseUpdateNotes } from '../../../features/changelog/parseUpdateNotes';
import { prefetchReleaseImages } from '../../../features/changelog/prefetchReleaseImages';
import { getPendingUpdate } from './pendingUpdate';
import type { GetFn, SetFn } from './types';

export const downloadUpdate = (set: SetFn, _get: GetFn) => {
  return async (): Promise<void> => {
    const update = getPendingUpdate();
    if (update === null) {
      return;
    }
    set({ updaterStatus: 'downloading-bg', updateFailure: null });
    try {
      await update.download();
      const notes = parseUpdateNotes({ version: update.version, body: update.body ?? '' });
      if (notes !== null) {
        prefetchReleaseImages({ release: notes });
      }
      set({ updaterStatus: 'ready', updateNotes: notes });
    } catch (err) {
      set({
        updaterStatus: 'available',
        updateFailure: { phase: 'download', message: formatError(err) },
      });
    }
  };
};
