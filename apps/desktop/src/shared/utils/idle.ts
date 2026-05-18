// Schedules `fn` to run when the browser is idle. Returns a cancel function.
// Falls back to setTimeout(0) on platforms without requestIdleCallback.
//
// `timeout` ensures the work eventually runs even on a perpetually busy main
// thread — default 1s is enough for "after sidebar/skeleton paint" without
// users perceiving the deferred work as missing.
export function scheduleIdle(fn: () => void, timeout = 1000): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(() => fn(), { timeout });
    return () => cancelIdleCallback(handle);
  }
  const id = window.setTimeout(fn, 0);
  return () => window.clearTimeout(id);
}
