import { useEffect, useState } from 'react';
import { startPoll } from '../../../shared/lib/usePoll/startPoll';
import type { BootPhase } from '../../../store/slices/boot/state';

type Params = {
  phase: BootPhase;
};

export const useElapsedSincePhase = ({ phase }: Params): number => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    setElapsedMs(0);
    return startPoll({
      run: () => setElapsedMs(Date.now() - startedAt),
      everyMs: 1_000,
      gate: 'visible',
      isImmediate: false,
    });
  }, [phase]);

  return elapsedMs;
};
