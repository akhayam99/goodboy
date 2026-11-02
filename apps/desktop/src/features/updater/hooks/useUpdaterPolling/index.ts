import { useEffect } from 'react';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';
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

    const stopPoll = startPoll({
      run: maybeCheck,
      everyMs: POLL_INTERVAL_MS,
      gate: 'visible',
      isImmediate: false,
    });
    window.addEventListener('focus', maybeCheck);

    return () => {
      stopPoll();
      window.removeEventListener('focus', maybeCheck);
    };
  }, [checkForUpdates]);
};
