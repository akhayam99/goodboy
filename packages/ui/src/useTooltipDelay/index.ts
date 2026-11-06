import { useCallback, useRef } from 'react';

type Params = {
  readonly isQuietNow: () => boolean;
  readonly restDelayMs?: number;
  readonly setIsHovered: (isHovered: boolean) => void;
};

const DEFAULT_DELAY_MS = 400;

export const useTooltipDelay = ({ isQuietNow, restDelayMs, setIsHovered }: Params) => {
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPendingRef = useRef(false);

  const clearDelay = useCallback(() => {
    if (delayRef.current === null) {
      return;
    }
    clearTimeout(delayRef.current);
    delayRef.current = null;
  }, []);

  const startDelay = useCallback(() => {
    clearDelay();
    if (isQuietNow()) {
      return;
    }
    delayRef.current = setTimeout(() => {
      delayRef.current = null;
      if (isQuietNow() || !isPendingRef.current) {
        return;
      }
      setIsHovered(true);
    }, restDelayMs ?? DEFAULT_DELAY_MS);
  }, [clearDelay, isQuietNow, restDelayMs, setIsHovered]);

  const open = () => {
    isPendingRef.current = true;
    clearDelay();
    setIsHovered(true);
  };

  return { isPendingRef, clearDelay, startDelay, open };
};
