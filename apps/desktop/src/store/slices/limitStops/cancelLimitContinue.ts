import { limitTimers } from './limitTimers';
import type { LimitStopRunParams, LimitStopsDeps } from './types';

export const cancelLimitContinue = ({ set, get }: LimitStopsDeps) => {
  return ({ runId }: LimitStopRunParams): void => {
    const stop = get().limitStops[runId];
    if (stop === undefined || !stop.isScheduled) {
      return;
    }
    limitTimers.stop({ runId });
    set((state) => {
      const current = state.limitStops[runId];
      if (current === undefined) {
        return {};
      }
      return { limitStops: { ...state.limitStops, [runId]: { ...current, isScheduled: false } } };
    });
  };
};
