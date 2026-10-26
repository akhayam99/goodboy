import { keepLimitStops } from './keepLimitStops';
import { limitTimers } from './limitTimers';
import type { LimitStopRunParams, LimitStopsDeps } from './types';

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 2_147_483_647;

export const continueAfterLimit = ({ set, get }: LimitStopsDeps) => {
  const fire = ({ runId }: LimitStopRunParams): void => {
    const stop = get().limitStops[runId];
    if (stop === undefined || !stop.isScheduled) {
      return;
    }
    set((state) => ({
      limitStops: keepLimitStops({ stops: state.limitStops, withoutRunId: runId }),
    }));
    get()
      .sendTurn(stop.input)
      .catch((error: unknown) =>
        get().reportError({
          title: "Couldn't continue after the usage limit",
          error,
          sessionId: stop.sessionId,
        }),
      );
  };
  return ({ runId }: LimitStopRunParams): void => {
    const stop = get().limitStops[runId];
    if (stop === undefined || stop.isScheduled) {
      return;
    }
    const delayMs = Math.min(Math.max(stop.resetAtMs - Date.now(), MIN_DELAY_MS), MAX_DELAY_MS);
    limitTimers.start({ runId, delayMs, onFire: () => fire({ runId }) });
    set((state) => {
      const current = state.limitStops[runId];
      if (current === undefined) {
        return {};
      }
      return { limitStops: { ...state.limitStops, [runId]: { ...current, isScheduled: true } } };
    });
  };
};
