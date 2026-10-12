import type { SliceDeps } from '../../slice-types';
import type { HistoryMountInput } from './types';

export const clearLiveHistoryError =
  ({ set }: SliceDeps) =>
  ({ mountId }: HistoryMountInput): void => {
    set((state) => {
      const live = state.historyLiveSessions[mountId];
      if (live === undefined || live.isBusy) {
        return state;
      }
      return {
        historyLiveSessions: {
          ...state.historyLiveSessions,
          [mountId]: {
            ...live,
            error: null,
            pending: null,
            shouldStashFiles: false,
            hasConflict: false,
          },
        },
      };
    });
  };
