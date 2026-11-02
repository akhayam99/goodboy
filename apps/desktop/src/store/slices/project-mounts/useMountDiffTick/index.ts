import { useSyncExternalStore } from 'react';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';
import { clearMountChangedFiles } from '../loadMountChangedFiles';

const MOUNT_DIFF_POLL_MS = 30_000;

let mountDiffTick = 0;
let stopMountDiffPoll: (() => void) | null = null;
const mountDiffTickListeners = new Set<() => void>();

const bumpMountDiffTick = (): void => {
  mountDiffTick += 1;
  for (const listener of mountDiffTickListeners) {
    listener();
  }
};

const readMountDiffTick = (): number => mountDiffTick;

const subscribeMountDiffTick = (listener: () => void): (() => void) => {
  mountDiffTickListeners.add(listener);
  if (stopMountDiffPoll === null && typeof window !== 'undefined') {
    stopMountDiffPoll = startPoll({
      run: bumpMountDiffTick,
      everyMs: MOUNT_DIFF_POLL_MS,
      gate: 'visible',
      isImmediate: false,
    });
  }
  return () => {
    mountDiffTickListeners.delete(listener);
    if (mountDiffTickListeners.size === 0) {
      clearMountChangedFiles();
    }
    if (mountDiffTickListeners.size > 0 || stopMountDiffPoll === null) {
      return;
    }
    stopMountDiffPoll();
    stopMountDiffPoll = null;
  };
};

export const useMountDiffTick = (): number =>
  useSyncExternalStore(subscribeMountDiffTick, readMountDiffTick, readMountDiffTick);
