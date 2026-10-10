import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../store/store';
import { hasUnhealthyProvider } from '../../../store/slices/providers/providerHealth';
import {
  ACTIVE_CONNECT_PHASES,
  ACTIVE_LIFECYCLE_PHASES,
} from '../../../store/slices/providers/types';

const DEBOUNCE_MS = 500;
const LIFECYCLE_RETRY_MS = 2_000;
const HEALTHY_TTL_MS = 5 * 60_000;
const UNHEALTHY_TTL_MS = 60_000;

const refreshTtlMs = (): number =>
  hasUnhealthyProvider({ map: useAppStore.getState().providerHealth })
    ? UNHEALTHY_TTL_MS
    : HEALTHY_TTL_MS;

type ScheduleParams = {
  readonly delayMs?: number;
};

export const useProviderRefreshOnFocus = (): void => {
  const refreshProviders = useAppStore((s) => s.refreshProviders);
  const bootPhase = useAppStore((s) => s.bootPhase);
  const lastRunAtRef = useRef(0);

  useEffect(() => {
    let timer: number | null = null;

    const schedule = ({ delayMs = DEBOUNCE_MS }: ScheduleParams): void => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        timer = null;
        const ttlMs = refreshTtlMs();
        const elapsed = Date.now() - lastRunAtRef.current;
        if (elapsed < ttlMs) {
          schedule({ delayMs: ttlMs - elapsed });
          return;
        }

        const { providerLifecycle, providerConnect } = useAppStore.getState();
        const inFlight =
          Object.values(providerLifecycle).some((l) => ACTIVE_LIFECYCLE_PHASES.has(l.phase)) ||
          Object.values(providerConnect).some((c) => ACTIVE_CONNECT_PHASES.has(c.phase));
        if (inFlight) {
          schedule({ delayMs: LIFECYCLE_RETRY_MS });
          return;
        }

        lastRunAtRef.current = Date.now();
        void refreshProviders();
      }, delayMs);
    };

    const onFocus = (): void => schedule({});
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        schedule({});
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    if (bootPhase === 'ready') {
      schedule({});
    }
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [bootPhase, refreshProviders]);
};
