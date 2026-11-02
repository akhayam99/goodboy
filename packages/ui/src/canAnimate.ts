import { prefersReducedMotion } from './prefersReducedMotion';

type Params = {
  readonly element: Element | null;
};

export const canAnimate = ({ element }: Params): boolean => {
  if (element === null || prefersReducedMotion()) {
    return false;
  }
  return element.getBoundingClientRect().width > 0;
};
