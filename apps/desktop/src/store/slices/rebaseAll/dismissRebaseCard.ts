import type { MountId, SessionId } from '@goodboy/types';
import { isHistoryRunActive } from '../history/isHistoryRunActive';
import { settledStopsOfMount } from './settledStopsOfMount';
import { writeSettledStops } from './writeSettledStops';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const dismissRebaseCard = ({ set, get }: SliceDeps) => {
  return ({ sessionId, mountId }: Params): void => {
    const before = get().settledRebaseStops;
    set((state) => {
      const run = state.historyRuns[mountId];
      if (run !== undefined && isHistoryRunActive({ phase: run.phase })) {
        return state;
      }
      const settled = settledStopsOfMount({
        settled: state.settledRebaseStops,
        events: state.sessionEvents?.[sessionId],
        sessionId,
        mountId,
      });
      const isRunDropped = run !== undefined && run.sessionId === sessionId;
      if (settled === null && !isRunDropped) {
        return state;
      }
      const { [mountId]: _dismissed, ...historyRuns } = state.historyRuns;
      return {
        ...(isRunDropped && { historyRuns }),
        ...(settled !== null && { settledRebaseStops: settled }),
      };
    });
    const after = get().settledRebaseStops;
    if (after !== before) {
      writeSettledStops({ stops: after });
    }
  };
};
