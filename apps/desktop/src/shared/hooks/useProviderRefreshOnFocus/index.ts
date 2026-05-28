import { useEffect } from 'react';
import { useAppStore } from '../../../store/store';

const DEBOUNCE_MS = 500;

/**
 * Re-detects CLI presence + auth state when the app regains focus or its tab
 * becomes visible again. This is the coherence backstop for changes made
 * outside the app (e.g. user runs `npm i -g @anthropic-ai/claude-code` in
 * their own shell, or `claude /logout` in another terminal). On focus the
 * provider list resyncs with ground truth.
 *
 * Lifecycle-driven refreshes (after the embedded install/login/logout flow)
 * already happen via the `provider-lifecycle-exit` event, this hook covers
 * the gap when state changes elsewhere on the machine.
 */
export function useProviderRefreshOnFocus(): void {
  const refreshProviders = useAppStore((s) => s.refreshProviders);

  useEffect(() => {
    let timer: number | null = null;
    let lastRunAt = 0;

    const schedule = (): void => {
      const now = Date.now();
      const elapsed = now - lastRunAt;
      const wait = elapsed >= DEBOUNCE_MS ? 0 : DEBOUNCE_MS - elapsed;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        lastRunAt = Date.now();
        timer = null;
        void refreshProviders();
      }, wait);
    };

    const onFocus = (): void => schedule();
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') schedule();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [refreshProviders]);
}
