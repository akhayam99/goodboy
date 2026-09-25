import { useCallback, useEffect, useRef, useState } from 'react';

type Params = {
  readonly enterDelayMs: number;
  readonly leaveDelayMs: number;
  readonly isDisabled: boolean;
};

export const useHoverIntent = ({ enterDelayMs, leaveDelayMs, isDisabled }: Params) => {
  const [isHovering, setIsHovering] = useState(false);
  const timer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current === null) {
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const onPointerEnter = useCallback(() => {
    clearTimer();
    if (isDisabled) {
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setIsHovering(true);
    }, enterDelayMs);
  }, [clearTimer, enterDelayMs, isDisabled]);

  const onPointerLeave = useCallback(() => {
    clearTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setIsHovering(false);
    }, leaveDelayMs);
  }, [clearTimer, leaveDelayMs]);

  useEffect(() => {
    if (!isDisabled) {
      return;
    }
    clearTimer();
    setIsHovering(false);
  }, [clearTimer, isDisabled]);

  useEffect(() => clearTimer, [clearTimer]);

  return { isHovering: isHovering && !isDisabled, onPointerEnter, onPointerLeave };
};
