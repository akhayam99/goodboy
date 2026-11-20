import { useCallback, useEffect, useRef, useState } from 'react';

const ARMED_MS = 3_000;

type Params = {
  readonly press: (() => void) | null;
  readonly isStopping: boolean;
  readonly isBlocked: () => boolean;
};

type Result = Readonly<{
  isArmed: boolean;
  onEscape: () => boolean;
}>;

export const useEscapeArm = ({ press, isStopping, isBlocked }: Params): Result => {
  const isLive = press !== null;
  const [isArmed, setIsArmed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const disarm = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsArmed(false);
  }, []);

  useEffect(() => {
    if (!isLive) {
      disarm();
    }
    return disarm;
  }, [disarm, isLive]);

  const onEscape = useCallback((): boolean => {
    if (press === null || isStopping || isBlocked()) {
      return false;
    }
    if (!isArmed) {
      setIsArmed(true);
      timerRef.current = window.setTimeout(disarm, ARMED_MS);
      return true;
    }
    disarm();
    press();
    return true;
  }, [disarm, isArmed, isBlocked, isStopping, press]);

  return { isArmed, onEscape };
};
