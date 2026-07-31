import { useEffect, useRef, useState } from 'react';

type Params = {
  running: boolean;
};

export const useElapsedMs = ({ running }: Params): number | null => {
  const startedAt = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    if (!running) {
      startedAt.current = null;
      return;
    }
    const start = Date.now();
    startedAt.current = start;
    setElapsedMs(0);
    const handle = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 1_000);
    return () => {
      window.clearInterval(handle);
      setElapsedMs(Date.now() - start);
    };
  }, [running]);

  return elapsedMs;
};
