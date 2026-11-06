import { useCallback, useEffect, useRef, useState } from 'react';
import { transientEscapeLayerCount } from '@goodboy/ui';
import { isOverlayOpen } from '../../../../../../shared/keyboard/isOverlayOpen';
import { useShortcut } from '../../../../../../shared/keyboard/useShortcut';
import type { ConversationStop } from '../../../../../../shared/types/conversationStop';

const ARMED_MS = 3_000;

type Params = {
  readonly stop: ConversationStop | null;
  readonly isCovered: boolean;
};

type Result = Readonly<{
  isArmed: boolean;
  onEscape: () => boolean;
}>;

export const useEscapeStop = ({ stop, isCovered }: Params): Result => {
  const isLive = stop !== null;
  const phase = stop?.phase ?? 'idle';
  const press = stop?.stop;
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
    if (press === undefined || phase === 'stopping') {
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
    press();
    return true;
  }, [disarm, isArmed, phase, press]);

  useShortcut('agent.stop', onEscape, isLive && !isCovered, { canDecline: true });

  return { isArmed, onEscape };
};
