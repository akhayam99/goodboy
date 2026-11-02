import { useEffect, useRef, useState } from 'react';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';

type Params = {
  readonly running: boolean;
  readonly startedAt?: string | null;
  readonly endedAt?: string | null;
};

export const useElapsedMs = ({
  running,
  startedAt = null,
  endedAt = null,
}: Params): number | null => {
  const start = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    if (!running) {
      start.current = null;
      return;
    }
    const begin = startedAt !== null ? Date.parse(startedAt) : Date.now();
    start.current = begin;
    setElapsedMs(Date.now() - begin);
    const stopPoll = startPoll({
      run: () => setElapsedMs(Date.now() - begin),
      everyMs: 1_000,
      gate: 'visible',
      isImmediate: false,
    });
    return () => {
      stopPoll();
      setElapsedMs(Date.now() - begin);
    };
  }, [running, startedAt]);

  if (endedAt !== null && startedAt !== null) {
    return Date.parse(endedAt) - Date.parse(startedAt);
  }
  if (!running && startedAt !== null) {
    return Date.now() - Date.parse(startedAt);
  }
  return elapsedMs;
};
