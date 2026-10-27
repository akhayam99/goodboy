import type { ProviderRunId } from '@goodboy/types';

type StartParams = {
  readonly runId: ProviderRunId;
  readonly delayMs: number;
  readonly onFire: () => void;
};

type StopParams = {
  readonly runId: ProviderRunId;
};

const timers = new Map<ProviderRunId, ReturnType<typeof setTimeout>>();

export const limitTimers = {
  start: ({ runId, delayMs, onFire }: StartParams): void => {
    const previous = timers.get(runId);
    if (previous !== undefined) {
      clearTimeout(previous);
    }
    timers.set(
      runId,
      setTimeout(() => {
        timers.delete(runId);
        onFire();
      }, delayMs),
    );
  },
  stop: ({ runId }: StopParams): void => {
    const timer = timers.get(runId);
    if (timer === undefined) {
      return;
    }
    clearTimeout(timer);
    timers.delete(runId);
  },
};
