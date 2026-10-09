import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { RUN_WATCHDOG_TICK_MS } from '../../../../store/slices/workflows/sweepIdleRuns';

export const useRunWatchdog = (): void => {
  const sweepIdleRuns = useAppStore((state) => state.sweepIdleRuns);

  useEffect(() => {
    const sweep = (): void => {
      void sweepIdleRuns();
    };
    const sweepWhenVisible = (): void => {
      if (document.visibilityState === 'visible') {
        sweep();
      }
    };
    const intervalId = window.setInterval(sweep, RUN_WATCHDOG_TICK_MS);
    window.addEventListener('focus', sweepWhenVisible);
    document.addEventListener('visibilitychange', sweepWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', sweepWhenVisible);
      document.removeEventListener('visibilitychange', sweepWhenVisible);
    };
  }, [sweepIdleRuns]);
};
