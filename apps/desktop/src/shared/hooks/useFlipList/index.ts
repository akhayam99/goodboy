import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

export const FLIP_DURATION_MS = 360;
const FLIP_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

type Params = {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly orderKey: string;
};

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useFlipList = ({ containerRef, orderKey }: Params): void => {
  const lastTops = useRef<ReadonlyMap<string, number>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const isReduced = prefersReducedMotion();
    const origin = container.getBoundingClientRect().top;
    const nextTops = new Map<string, number>();
    for (const element of container.querySelectorAll<HTMLElement>('[data-flip-key]')) {
      const key = element.dataset.flipKey ?? '';
      const top = element.getBoundingClientRect().top - origin;
      nextTops.set(key, top);
      const previous = lastTops.current.get(key);
      if (previous === undefined || previous === top || isReduced) {
        continue;
      }
      if (typeof element.animate !== 'function') {
        continue;
      }
      element.animate(
        [{ transform: `translateY(${previous - top}px)` }, { transform: 'translateY(0)' }],
        { duration: FLIP_DURATION_MS, easing: FLIP_EASING },
      );
    }
    lastTops.current = nextTops;
  }, [containerRef, orderKey]);
};
