import { useEffect } from 'react';
import { useAppStore } from '../../../store/store';

const DEBOUNCE_MS = 500;
const REFRESH_TTL_MS = 60_000;

export const useProviderRefreshOnFocus = (): void => {
  const refreshProviders = useAppStore((s) => s.refreshProviders);

  useEffect(() => {
    let timer: number | null = null;
    let lastRunAt = 0;

    const schedule = (): void => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        timer = null;
        const elapsed = Date.now() - lastRunAt;
        if (elapsed < REFRESH_TTL_MS) {
          return;
        }

        const lifecycle = useAppStore.getState().providerLifecycle;
        const inFlight = Object.values(lifecycle).some(
          (l) =>
            l.phase === 'installing' || l.phase === 'connecting' || l.phase === 'disconnecting',
        );
        if (inFlight) {
          return;
        }

        lastRunAt = Date.now();
        void refreshProviders();
      }, DEBOUNCE_MS);
    };

    const onFocus = (): void => schedule();
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        schedule();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [refreshProviders]);
};
