import { useEffect } from 'react';
import { startPoll } from '../../../../shared/lib/usePoll/startPoll';
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
    const stopPoll = startPoll({
      run: sweep,
      everyMs: RUN_WATCHDOG_TICK_MS,
      gate: 'always',
      isImmediate: false,
    });
    window.addEventListener('focus', sweepWhenVisible);
    document.addEventListener('visibilitychange', sweepWhenVisible);
    return () => {
      stopPoll();
      window.removeEventListener('focus', sweepWhenVisible);
      document.removeEventListener('visibilitychange', sweepWhenVisible);
    };
  }, [sweepIdleRuns]);
};
