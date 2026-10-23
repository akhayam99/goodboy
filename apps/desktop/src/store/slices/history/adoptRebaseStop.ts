import type { SliceDeps } from '../../slice-types';
import { selectRebaseStop } from './selectRebaseStop';
import type { HistoryMountInput, HistoryRun } from './types';

export const adoptRebaseStop =
  ({ set, get }: SliceDeps) =>
  ({ sessionId, mountId }: HistoryMountInput): HistoryRun | null => {
    const stop = selectRebaseStop({ state: get(), sessionId, mountId });
    if (stop === null) {
      return null;
    }
    if (!stop.isRebuilt) {
      return stop.run;
    }
    set((state) =>
      state.historyRuns[mountId] === undefined
        ? { historyRuns: { ...state.historyRuns, [mountId]: stop.run } }
        : {},
    );
    return get().historyRuns[mountId] ?? null;
  };
