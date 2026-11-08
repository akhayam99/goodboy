import { useEffect } from 'react';
import { useAppStore } from '../../../store';
import { joinMonitorPoll } from './joinMonitorPoll';

const POLL_INTERVAL_MS = 5000;

type Params = {
  readonly isEnabled?: boolean;
};

export const useMonitorPolling = ({ isEnabled = true }: Params = {}): void => {
  const refreshMonitorSnapshot = useAppStore((state) => state.refreshMonitorSnapshot);
  const loadWatchedPorts = useAppStore((state) => state.loadWatchedPorts);

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    void loadWatchedPorts().then(() => refreshMonitorSnapshot());
    return joinMonitorPoll({
      run: () => void useAppStore.getState().refreshMonitorSnapshot(),
      everyMs: POLL_INTERVAL_MS,
    });
  }, [isEnabled, loadWatchedPorts, refreshMonitorSnapshot]);
};
