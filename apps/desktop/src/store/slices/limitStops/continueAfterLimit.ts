import { CHECK_STATE } from '../notifications/errorRecovery';
import { turnRefusalMessage } from '../turn/refusal/turnRefusalMessage';
import { turnRefusalOf } from '../turn/refusal/turnRefusalOf';
import { keepLimitStops } from './keepLimitStops';
import { limitTimers } from './limitTimers';
import { noticeAutoOfRefusedContinue } from './noticeAutoOfRefusedContinue';
import type { LimitStop } from './state';
import type { LimitStopRunParams, LimitStopsDeps } from './types';

const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 2_147_483_647;

type RestoreParams = Readonly<{
  stop: LimitStop;
}>;

export const continueAfterLimit = ({ set, get }: LimitStopsDeps) => {
  const restore = ({ stop }: RestoreParams): void => {
    set((state) => {
      const isReplaced = Object.values(state.limitStops).some(
        (other) => other.agentId === stop.agentId,
      );
      if (isReplaced) {
        return {};
      }
      return { limitStops: { ...state.limitStops, [stop.runId]: { ...stop, isScheduled: false } } };
    });
  };
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
      .then((result) => {
        const refusal = turnRefusalOf({ result });
        if (refusal === null) {
          return undefined;
        }
        restore({ stop });
        return noticeAutoOfRefusedContinue({
          get,
          stop,
          message: turnRefusalMessage({ refusal }),
        });
      })
      .catch((error: unknown) =>
        get().reportError({
          recovery: CHECK_STATE,
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
