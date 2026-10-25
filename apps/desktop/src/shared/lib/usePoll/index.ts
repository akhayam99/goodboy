import { useEffect, useRef } from 'react';
import { startPoll, type PollGate } from './startPoll';

type Params = {
  readonly run: () => void;
  readonly everyMs: number;
  readonly isEnabled?: boolean;
  readonly gate?: PollGate;
  readonly isImmediate?: boolean;
  readonly restartKey?: string;
};

export const usePoll = ({
  run,
  everyMs,
  isEnabled = true,
  gate = 'visible',
  isImmediate = true,
  restartKey = '',
}: Params): void => {
  const latestRun = useRef(run);
  latestRun.current = run;

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    return startPoll({ run: () => latestRun.current(), everyMs, gate, isImmediate });
  }, [everyMs, gate, isEnabled, isImmediate, restartKey]);
};
