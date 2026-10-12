import type { SliceDeps } from '../../slice-types';
import type { HistoryMountInput } from './types';
import { historyDraftReads } from './historyDraftReads';

type Params = HistoryMountInput & {
  readonly token: string;
  readonly isOpen: boolean;
};

export const setHistoryLiveSession =
  ({ set, get }: SliceDeps) =>
  ({ mountId, token, isOpen }: Params): void => {
    if (!isOpen && get().historyLiveSessions[mountId]?.token === token) {
      historyDraftReads.cancel({ key: mountId });
    }
    set((state) => {
      if (!isOpen) {
        if (state.historyLiveSessions[mountId]?.token !== token) {
          return state;
        }
        const { [mountId]: removed, ...historyLiveSessions } = state.historyLiveSessions;
        return { historyLiveSessions };
      }
      return {
        historyLiveSessions: {
          ...state.historyLiveSessions,
          [mountId]: {
            token,
            undo: [],
            redo: [],
            isBusy: false,
            busySha: null,
            error: null,
            hasConflict: false,
            shouldStashFiles: false,
            pending: null,
          },
        },
      };
    });
  };
