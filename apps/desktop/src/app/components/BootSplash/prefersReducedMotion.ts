export const prefersReducedMotion = (): boolean => {
  if (typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
