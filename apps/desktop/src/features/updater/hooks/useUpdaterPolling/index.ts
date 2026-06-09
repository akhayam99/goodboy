import { useEffect } from 'react';
import { useAppStore } from '../../../../store';

const POLL_INTERVAL_MS = 60 * 60_000;
const RECHECK_TTL_MS = 30 * 60_000;

export const useUpdaterPolling = (): void => {
  const checkForUpdates = useAppStore((s) => s.checkForUpdates);

  useEffect(() => {
    if (!import.meta.env.PROD) {
      return;
    }

    let lastRunAt = 0;

    const maybeCheck = (): void => {
      const status = useAppStore.getState().updaterStatus;
      if (status === 'checking' || status === 'downloading' || status === 'available') {
        return;
      }
      if (Date.now() - lastRunAt < RECHECK_TTL_MS) {
        return;
      }
      lastRunAt = Date.now();
      void checkForUpdates();
    };

    const tick = (): void => {
      if (document.visibilityState === 'visible') {
        maybeCheck();
      }
    };

    const intervalId = window.setInterval(tick, POLL_INTERVAL_MS);
    window.addEventListener('focus', maybeCheck);
    document.addEventListener('visibilitychange', tick);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', maybeCheck);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [checkForUpdates]);
};
