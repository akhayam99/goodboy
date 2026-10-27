import { useCallback, useEffect, useRef, useState } from 'react';
import { transientEscapeLayerCount } from '@goodboy/ui';
import type { StopPhase } from '../../../../../../shared/hooks/useAgentStop';
import { isOverlayOpen } from '../../../../../../shared/keyboard/isOverlayOpen';
import { useShortcut } from '../../../../../../shared/keyboard/useShortcut';

const ARMED_MS = 3_000;

type Params = {
  readonly isLive: boolean;
  readonly phase: StopPhase;
  readonly stop: () => void;
};

type Result = Readonly<{
  isArmed: boolean;
  onEscape: () => boolean;
}>;

export const useEscapeStop = ({ isLive, phase, stop }: Params): Result => {
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
    if (!isLive || phase === 'stopping') {
      return false;
    }
    if (transientEscapeLayerCount() > 0 || isOverlayOpen({})) {
      return false;
    }
    if (!isArmed) {
      setIsArmed(true);
      timerRef.current = window.setTimeout(disarm, ARMED_MS);
      return true;
    }
    disarm();
    stop();
    return true;
  }, [disarm, isArmed, isLive, phase, stop]);

  useShortcut('agent.stop', onEscape, isLive, { canDecline: true });

  return { isArmed, onEscape };
};
