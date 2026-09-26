import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../store/store';

const REFRESH_TTL_MS = 15 * 60 * 1000;
const DEBOUNCE_MS = 500;

export const useProviderLimitsProbe = (): void => {
  const probeProviderLimits = useAppStore((s) => s.probeProviderLimits);
  const bootPhase = useAppStore((s) => s.bootPhase);
  const lastRunAtRef = useRef(0);

  useEffect(() => {
    if (bootPhase !== 'ready') {
      return;
    }
    let timer: number | null = null;

    const schedule = (delayMs: number): void => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        timer = null;
        const elapsed = Date.now() - lastRunAtRef.current;
        if (elapsed < REFRESH_TTL_MS) {
          schedule(REFRESH_TTL_MS - elapsed);
          return;
        }
        lastRunAtRef.current = Date.now();
        void probeProviderLimits();
        schedule(REFRESH_TTL_MS);
      }, delayMs);
    };

    lastRunAtRef.current = Date.now();
    const onFocus = (): void => schedule(DEBOUNCE_MS);
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        schedule(DEBOUNCE_MS);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    schedule(REFRESH_TTL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [bootPhase, probeProviderLimits]);
};
