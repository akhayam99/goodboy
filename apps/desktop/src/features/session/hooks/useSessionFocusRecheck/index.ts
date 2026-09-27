import { useEffect } from 'react';
import { useAppStore } from '../../../../store';

export const FOCUS_RECHECK_DEBOUNCE_MS = 400;

export const useSessionFocusRecheck = (): void => {
  const recheckSessionMounts = useAppStore((s) => s.recheckSessionMounts);

  useEffect(() => {
    let timer: number | null = null;
    const schedule = (): void => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        timer = null;
        const sessionId = useAppStore.getState().currentSessionId;
        if (sessionId !== null) {
          void recheckSessionMounts({ sessionId, reason: 'focus' });
        }
      }, FOCUS_RECHECK_DEBOUNCE_MS);
    };
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [recheckSessionMounts]);
};
