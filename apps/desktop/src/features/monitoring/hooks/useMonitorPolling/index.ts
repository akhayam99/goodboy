import { useEffect } from 'react';
import { useAppStore } from '../../../../store';

const POLL_INTERVAL_MS = 5000;

const isWatching = (): boolean => document.visibilityState === 'visible' && document.hasFocus();

export const useMonitorPolling = (): void => {
  const refreshMonitorSnapshot = useAppStore((state) => state.refreshMonitorSnapshot);
  const loadWatchedPorts = useAppStore((state) => state.loadWatchedPorts);

  useEffect(() => {
    const tick = (): void => {
      if (isWatching()) {
        void refreshMonitorSnapshot();
      }
    };
    void loadWatchedPorts().then(tick);
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshMonitorSnapshot, loadWatchedPorts]);
};
