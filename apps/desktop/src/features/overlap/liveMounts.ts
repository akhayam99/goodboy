import { startPoll } from '../../shared/lib/usePoll/startPoll';
import { readLiveMounts, type LiveMount } from './readLiveMounts';

export const LIVE_MOUNTS_EVERY_MS = 30_000;

export type LiveMountsSnapshot = Readonly<{
  mounts: ReadonlyArray<LiveMount>;
  isLoaded: boolean;
  hasFailed: boolean;
}>;

type SubscribeParams = Readonly<{
  listener: () => void;
}>;

const EMPTY: LiveMountsSnapshot = { mounts: [], isLoaded: false, hasFailed: false };

const listeners = new Set<() => void>();
let snapshot: LiveMountsSnapshot = EMPTY;
let ticket = 0;
let stopPoll: (() => void) | null = null;

const emit = (): void => {
  for (const listener of [...listeners]) {
    listener();
  }
};

const read = async (): Promise<void> => {
  ticket += 1;
  const mine = ticket;
  try {
    const mounts = await readLiveMounts();
    if (mine !== ticket) {
      return;
    }
    snapshot = { mounts, isLoaded: true, hasFailed: false };
  } catch {
    if (mine !== ticket) {
      return;
    }
    snapshot = { ...snapshot, hasFailed: true };
  }
  emit();
};

const stop = (): void => {
  stopPoll?.();
  stopPoll = null;
};

export const liveMounts = {
  snapshot: (): LiveMountsSnapshot => snapshot,
  refresh: (): Promise<void> => read(),
  subscribe: ({ listener }: SubscribeParams): (() => void) => {
    listeners.add(listener);
    if (stopPoll === null) {
      stopPoll = startPoll({
        run: () => void read(),
        everyMs: LIVE_MOUNTS_EVERY_MS,
        gate: 'visible',
        isImmediate: true,
      });
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        stop();
      }
    };
  },
  reset: (): void => {
    stop();
    listeners.clear();
    ticket += 1;
    snapshot = EMPTY;
  },
};
