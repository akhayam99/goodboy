const IDLE_TIMEOUT_MS = 2_000;

export const waitForIdle = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS });
      return;
    }
    setTimeout(resolve, 0);
  });
