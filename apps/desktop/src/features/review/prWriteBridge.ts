import type { UnlistenFn } from '@tauri-apps/api/event';
import { useAppStore } from '../../store/store';
import { listenPrWrites } from './prWriteBus';

const SWEEP_INTERVAL_MS = 30_000;

export const startPrWriteBridge = async (): Promise<UnlistenFn> => {
  const unlisten = await listenPrWrites((announcement) => {
    useAppStore.getState().notePrWrite(announcement);
  });
  const timer = setInterval(() => {
    useAppStore.getState().sweepPrWriteClaims();
  }, SWEEP_INTERVAL_MS);
  return () => {
    clearInterval(timer);
    unlisten();
  };
};
