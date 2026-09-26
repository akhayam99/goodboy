import { useEffect, useState } from 'react';

export const AUTH_LINK_REVEAL_MS = 4_000;

type Params = {
  readonly isActive: boolean;
  readonly delayMs: number;
};

export const useDelayedReveal = ({ isActive, delayMs }: Params): boolean => {
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setIsRevealed(false);
      return;
    }
    const timer = window.setTimeout(() => setIsRevealed(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [isActive, delayMs]);

  return isActive && isRevealed;
};
