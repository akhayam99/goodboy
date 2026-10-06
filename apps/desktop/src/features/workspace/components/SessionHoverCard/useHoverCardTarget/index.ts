import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';

const HOVER_CARD_REST_MS = 500;
const HOVER_CARD_LEAVE_MS = 180;

type HoverCardTarget = {
  readonly sessionId: SessionId;
  readonly anchor: HTMLElement;
};

type Timer = ReturnType<typeof setTimeout>;

export type HoverCardController = {
  readonly target: HoverCardTarget | null;
  readonly enter: (target: HoverCardTarget) => void;
  readonly leave: () => void;
  readonly keep: () => void;
  readonly close: () => void;
};

export const useHoverCardTarget = (): HoverCardController => {
  const [target, setTarget] = useState<HoverCardTarget | null>(null);
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

  const close = useCallback(() => {
    clearTimers();
    isOpenRef.current = false;
    setTarget(null);
  }, [clearTimers]);

  const enter = useCallback(
    (next: HoverCardTarget) => {
      clearTimers();
      if (isOpenRef.current) {
        setTarget(next);
        return;
      }
      restTimer.current = setTimeout(() => {
        restTimer.current = null;
        isOpenRef.current = true;
        setTarget(next);
      }, HOVER_CARD_REST_MS);
    },
    [clearTimers],
  );

  const leave = useCallback(() => {
    clearTimers();
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      isOpenRef.current = false;
      setTarget(null);
    }, HOVER_CARD_LEAVE_MS);
  }, [clearTimers]);

  const keep = useCallback(() => {
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  return { target, enter, leave, keep, close };
};
