import { useEffect } from 'react';
import { useAppStore } from '../../../../store';

const PINS_FOCUS_RELOAD_DEBOUNCE_MS = 400;

export const useSessionPinsSync = (): void => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const loadSessionPins = useAppStore((state) => state.loadSessionPins);

  useEffect(() => {
    if (workspaceId === null) {
      return;
    }
    let timer: number | null = null;
    const load = (): void => {
      void loadSessionPins({ workspaceId }).catch(() => undefined);
    };
    const schedule = (): void => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        timer = null;
        load();
      }, PINS_FOCUS_RELOAD_DEBOUNCE_MS);
    };
    load();
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [workspaceId, loadSessionPins]);
};
