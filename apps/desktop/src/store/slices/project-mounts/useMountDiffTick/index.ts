import { useSyncExternalStore } from 'react';
import { clearMountChangedFiles } from '../loadMountChangedFiles';

const MOUNT_DIFF_POLL_MS = 30_000;

let mountDiffTick = 0;
let mountDiffTimer: number | null = null;
const mountDiffTickListeners = new Set<() => void>();

const bumpMountDiffTick = (): void => {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return;
  }
  mountDiffTick += 1;
  for (const listener of mountDiffTickListeners) {
    listener();
  }
};

const readMountDiffTick = (): number => mountDiffTick;

const subscribeMountDiffTick = (listener: () => void): (() => void) => {
  mountDiffTickListeners.add(listener);
  if (mountDiffTimer === null && typeof window !== 'undefined') {
    mountDiffTimer = window.setInterval(bumpMountDiffTick, MOUNT_DIFF_POLL_MS);
    document.addEventListener('visibilitychange', bumpMountDiffTick);
  }
  return () => {
    mountDiffTickListeners.delete(listener);
    if (mountDiffTickListeners.size === 0) {
      clearMountChangedFiles();
    }
    if (mountDiffTickListeners.size > 0 || mountDiffTimer === null) {
      return;
    }
    window.clearInterval(mountDiffTimer);
    mountDiffTimer = null;
    document.removeEventListener('visibilitychange', bumpMountDiffTick);
  };
};

export const useMountDiffTick = (): number =>
  useSyncExternalStore(subscribeMountDiffTick, readMountDiffTick, readMountDiffTick);
