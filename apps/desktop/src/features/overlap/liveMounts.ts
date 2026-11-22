import { startPoll } from '../../shared/lib/usePoll/startPoll';
import { useAppStore } from '../../store';
import { READ_FAILED } from '../../store/slices/notifications/errorRecovery';
import { readLiveMounts, type LiveMount } from './readLiveMounts';

export const LIVE_MOUNTS_EVERY_MS = 30_000;
export const OVERLAP_READ_FAILED = "Couldn't read which branches overlap";

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
  } catch (error) {
    if (mine !== ticket) {
      return;
    }
    snapshot = { ...snapshot, hasFailed: true };
    emit();
    void useAppStore.getState().reportError({
      recovery: READ_FAILED,
      title: OVERLAP_READ_FAILED,
      error,
      severity: 'warning',
      coalesceKey: 'overlap-read',
      retry: async () => {
        await read();
        return !snapshot.hasFailed;
      },
    });
    return;
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
