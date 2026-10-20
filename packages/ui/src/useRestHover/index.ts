import { useCallback, useEffect, useRef, useState } from 'react';

export const REST_HOVER_REST_MS = 500;
export const REST_HOVER_LEAVE_MS = 180;
const REST_HOVER_WARM_MS = 300;

type Timer = ReturnType<typeof setTimeout>;

type Params = {
  readonly restMs?: number;
  readonly leaveMs?: number;
  readonly hasWarmWindow?: boolean;
};

export type RestHover<T> = {
  readonly target: T | null;
  readonly enter: (target: T) => void;
  readonly openNow: (target: T) => void;
  readonly leave: () => void;
  readonly keep: () => void;
  readonly close: () => void;
};

let lastClosedAt = Number.NEGATIVE_INFINITY;

export const useRestHover = <T>({
  restMs = REST_HOVER_REST_MS,
  leaveMs = REST_HOVER_LEAVE_MS,
  hasWarmWindow = false,
}: Params): RestHover<T> => {
  const [target, setTarget] = useState<T | null>(null);
  const isOpenRef = useRef(false);
  const restTimer = useRef<Timer | null>(null);
  const leaveTimer = useRef<Timer | null>(null);

  const clearTimers = useCallback(() => {
    if (restTimer.current !== null) {
      clearTimeout(restTimer.current);
      restTimer.current = null;
    }
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  const shut = useCallback(() => {
    if (isOpenRef.current && hasWarmWindow) {
      lastClosedAt = Date.now();
    }
    isOpenRef.current = false;
    setTarget(null);
  }, [hasWarmWindow]);

  const close = useCallback(() => {
    clearTimers();
    shut();
  }, [clearTimers, shut]);

  const openNow = useCallback(
    (next: T) => {
      clearTimers();
      isOpenRef.current = true;
      setTarget(next);
    },
    [clearTimers],
  );

  const enter = useCallback(
    (next: T) => {
      clearTimers();
      const isWarm = hasWarmWindow && Date.now() - lastClosedAt < REST_HOVER_WARM_MS;
      if (isOpenRef.current || isWarm) {
        openNow(next);
        return;
      }
      restTimer.current = setTimeout(() => {
        restTimer.current = null;
        openNow(next);
      }, restMs);
    },
    [clearTimers, hasWarmWindow, openNow, restMs],
  );

  const leave = useCallback(() => {
    clearTimers();
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      shut();
    }, leaveMs);
  }, [clearTimers, leaveMs, shut]);

  const keep = useCallback(() => {
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  return { target, enter, openNow, leave, keep, close };
};
