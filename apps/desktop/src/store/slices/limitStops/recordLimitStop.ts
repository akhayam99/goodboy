import { keepLimitStops } from './keepLimitStops';
import { limitTimers } from './limitTimers';
import type { LimitStopsDeps, RecordLimitStopParams } from './types';

export const recordLimitStop = ({ set, get }: LimitStopsDeps) => {
  return ({ stop }: RecordLimitStopParams): void => {
    for (const earlier of Object.values(get().limitStops)) {
      if (earlier.agentId === stop.agentId) {
        limitTimers.stop({ runId: earlier.runId });
      }
    }
    set((state) => ({
      limitStops: {
        ...keepLimitStops({ stops: state.limitStops, withoutAgentId: stop.agentId }),
        [stop.runId]: stop,
      },
    }));
  };
};
