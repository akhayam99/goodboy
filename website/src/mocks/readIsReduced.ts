const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

export const readIsReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_QUERY).matches;
