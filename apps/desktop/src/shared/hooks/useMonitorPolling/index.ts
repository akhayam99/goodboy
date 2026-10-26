import { useEffect } from 'react';
import { useAppStore } from '../../../store';
import { usePoll } from '../../lib/usePoll';

const POLL_INTERVAL_MS = 5000;

export const useMonitorPolling = (): void => {
  const refreshMonitorSnapshot = useAppStore((state) => state.refreshMonitorSnapshot);
  const loadWatchedPorts = useAppStore((state) => state.loadWatchedPorts);

  useEffect(() => {
    void loadWatchedPorts().then(() => refreshMonitorSnapshot());
  }, [loadWatchedPorts, refreshMonitorSnapshot]);

  usePoll({
    run: () => void refreshMonitorSnapshot(),
    everyMs: POLL_INTERVAL_MS,
    gate: 'focused',
    isImmediate: false,
  });
};
