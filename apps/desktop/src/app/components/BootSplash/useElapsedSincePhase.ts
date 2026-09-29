import { useEffect, useState } from 'react';
import type { BootPhase } from '../../../store/slices/boot/state';

type Params = {
  phase: BootPhase;
};

export const useElapsedSincePhase = ({ phase }: Params): number => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    setElapsedMs(0);
    const intervalId = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [phase]);

  return elapsedMs;
};
