let last: HTMLElement | null = null;
let isTracking = false;

const onFocusIn = (event: FocusEvent): void => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target === document.body) {
    return;
  }
  last = target;
};

const startTracking = (): void => {
  if (isTracking || typeof document === 'undefined') {
    return;
  }
  document.addEventListener('focusin', onFocusIn);
  isTracking = true;
};

startTracking();

export const lastFocusedElement = (): HTMLElement | null => {
  startTracking();
  if (last === null || !last.isConnected) {
    return null;
  }
  return last;
};

export const useLastFocused = (): (() => HTMLElement | null) => lastFocusedElement;
