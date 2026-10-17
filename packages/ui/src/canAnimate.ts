type Params = {
  readonly element: Element | null;
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const canAnimate = ({ element }: Params): boolean => {
  if (element === null || prefersReducedMotion()) {
    return false;
  }
  return element.getBoundingClientRect().width > 0;
};
