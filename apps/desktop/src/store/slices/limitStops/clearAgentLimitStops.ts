import { keepLimitStops } from './keepLimitStops';
import { limitTimers } from './limitTimers';
import type { ClearAgentLimitStopsParams, LimitStopsDeps } from './types';

export const clearAgentLimitStops = ({ set, get }: LimitStopsDeps) => {
  return ({ agentId }: ClearAgentLimitStopsParams): void => {
    const stale = Object.values(get().limitStops).filter((stop) => stop.agentId === agentId);
    if (stale.length === 0) {
      return;
    }
    for (const stop of stale) {
      limitTimers.stop({ runId: stop.runId });
    }
    set((state) => ({
      limitStops: keepLimitStops({ stops: state.limitStops, withoutAgentId: agentId }),
    }));
  };
};
