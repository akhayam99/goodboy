import { useCallback, useEffect, useRef, useState } from 'react';

const REST_MS = 150;
const LEAVE_MS = 180;

export type RailFlyoutKey = 'session' | 'more';

export type RailFlyoutTarget = {
  readonly key: RailFlyoutKey;
  readonly anchor: HTMLElement;
};

type EnterParams = RailFlyoutTarget & {
  readonly isImmediate: boolean;
};

type Timer = ReturnType<typeof setTimeout>;

export type RailFlyoutController = {
  readonly target: RailFlyoutTarget | null;
  readonly enter: (params: EnterParams) => void;
  readonly leave: () => void;
  readonly keep: () => void;
  readonly close: () => void;
  readonly dismiss: () => void;
};

export const useRailFlyout = (): RailFlyoutController => {
  const [target, setTarget] = useState<RailFlyoutTarget | null>(null);
  const targetRef = useRef<RailFlyoutTarget | null>(null);
  const isFocusSuppressed = useRef(false);
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

  const show = useCallback((next: RailFlyoutTarget | null) => {
    targetRef.current = next;
    setTarget(next);
  }, []);

  const close = useCallback(() => {
    clearTimers();
    show(null);
  }, [clearTimers, show]);

  const dismiss = useCallback(() => {
    const anchor = targetRef.current?.anchor ?? null;
    clearTimers();
    show(null);
    if (anchor === null) {
      return;
    }
    if (document.activeElement === anchor) {
      return;
    }
    isFocusSuppressed.current = true;
    anchor.focus();
  }, [clearTimers, show]);

  const enter = useCallback(
    ({ key, anchor, isImmediate }: EnterParams) => {
      clearTimers();
      if (isImmediate && isFocusSuppressed.current) {
        isFocusSuppressed.current = false;
        return;
      }
      isFocusSuppressed.current = false;
      if (isImmediate) {
        show({ key, anchor });
        return;
      }
      restTimer.current = setTimeout(() => {
        restTimer.current = null;
        show({ key, anchor });
      }, REST_MS);
    },
    [clearTimers, show],
  );

  const leave = useCallback(() => {
    clearTimers();
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = null;
      show(null);
    }, LEAVE_MS);
  }, [clearTimers, show]);

  const keep = useCallback(() => {
    if (leaveTimer.current !== null) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  return { target, enter, leave, keep, close, dismiss };
};
