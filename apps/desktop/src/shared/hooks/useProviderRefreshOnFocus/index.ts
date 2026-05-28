import { useEffect } from 'react';
import { useAppStore } from '../../../store/store';

// Two layers of throttling. DEBOUNCE collapses a focus + visibilitychange
// burst from the same window-restore into one call. TTL guards against the
// real cost: a refresh re-runs detection + auth on all four providers, which
// even after the Rust-side async + spawn_blocking rework still costs a few
// hundred ms of subprocess wall time. No point repeating that every time the
// user alt-tabs out and back in.
const DEBOUNCE_MS = 500;
const REFRESH_TTL_MS = 60_000;

/**
 * Re-detects CLI presence + auth state when the app regains focus or its tab
 * becomes visible again. This is the coherence backstop for changes made
 * outside the app (e.g. user runs `npm i -g @anthropic-ai/claude-code` in
 * their own shell, or `claude /logout` in another terminal).
 *
 * Three guards keep this from being a perf footgun:
 *  - DEBOUNCE_MS: collapse focus + visibilitychange firing back-to-back.
 *  - REFRESH_TTL_MS: skip if we refreshed recently. Manual refresh button +
 *    lifecycle-exit event handle the in-app cases; this only catches
 *    external machine changes, which are rare.
 *  - Skip when any provider lifecycle is in flight: we already update on
 *    PTY exit with fresh ground truth, and the running PTY itself holds
 *    auth state in a transient form (entered codes, half-typed passwords).
 *    A refresh mid-run could race against the exit handler's atomic update.
 */
export function useProviderRefreshOnFocus(): void {
  const refreshProviders = useAppStore((s) => s.refreshProviders);

  useEffect(() => {
    let timer: number | null = null;
    let lastRunAt = 0;

    const schedule = (): void => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        const elapsed = Date.now() - lastRunAt;
        if (elapsed < REFRESH_TTL_MS) return;

        const lifecycle = useAppStore.getState().providerLifecycle;
        const inFlight = Object.values(lifecycle).some(
          (l) =>
            l.phase === 'installing' || l.phase === 'connecting' || l.phase === 'disconnecting',
        );
        if (inFlight) return;

        lastRunAt = Date.now();
        void refreshProviders();
      }, DEBOUNCE_MS);
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
