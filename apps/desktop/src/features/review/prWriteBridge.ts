import type { UnlistenFn } from '@tauri-apps/api/event';
import { startPoll } from '../../shared/lib/usePoll/startPoll';
import { useAppStore } from '../../store/store';
import { listenPrWrites } from './prWriteBus';

const SWEEP_INTERVAL_MS = 30_000;

export const startPrWriteBridge = async (): Promise<UnlistenFn> => {
  const unlisten = await listenPrWrites((announcement) => {
    useAppStore.getState().notePrWrite(announcement);
  });
  const stopPoll = startPoll({
    run: () => useAppStore.getState().sweepPrWriteClaims(),
    everyMs: SWEEP_INTERVAL_MS,
    gate: 'always',
    isImmediate: false,
  });
  return () => {
    stopPoll();
    unlisten();
  };
};
