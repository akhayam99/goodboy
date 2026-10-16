import { useEffect, useState } from 'react';
import type { IsoDateTime } from '@goodboy/types';
import { formatTailClock } from '../formatTailClock';

type Params = {
  readonly startedAt: IsoDateTime | null;
  readonly isTicking: boolean;
};

const TICK_MS = 1_000;

export const useTailClock = ({ startedAt, isTicking }: Params): string | null => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isTicking || startedAt === null) {
      return;
    }
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(handle);
  }, [isTicking, startedAt]);
  if (!isTicking || startedAt === null) {
    return null;
  }
  return formatTailClock({ elapsedMs: now - Date.parse(startedAt) });
};
