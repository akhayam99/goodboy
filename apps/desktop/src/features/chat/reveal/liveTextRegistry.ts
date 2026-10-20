import { REVEAL_PACE } from './revealNumbers';

const LIVE_MS = REVEAL_PACE.lagCapSeconds * 1000;
const RETAIN_MS = LIVE_MS * 4;
const lastDeltaAt = new Map<string, number>();

type RunParams = {
  readonly runId: string;
};

const prune = (now: number): void => {
  for (const [runId, at] of lastDeltaAt) {
    if (now - at > RETAIN_MS) {
      lastDeltaAt.delete(runId);
    }
  }
};

export const liveTextRegistry = {
  mark: ({ runId }: RunParams): void => {
    const now = performance.now();
    prune(now);
    lastDeltaAt.set(runId, now);
  },
  isLive: ({ runId }: RunParams): boolean => {
    const at = lastDeltaAt.get(runId);
    return at !== undefined && performance.now() - at <= LIVE_MS;
  },
  clear: (): void => {
    lastDeltaAt.clear();
  },
};
