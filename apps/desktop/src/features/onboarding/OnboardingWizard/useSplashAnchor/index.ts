import { useLayoutEffect, type RefObject } from 'react';
import { splashShift } from './splashShift';

type Params = {
  readonly markRef: RefObject<HTMLElement | null>;
  readonly blockRef: RefObject<HTMLElement | null>;
};

export const useSplashAnchor = ({ markRef, blockRef }: Params): void => {
  useLayoutEffect(() => {
    const place = () => {
      const mark = markRef.current;
      const block = blockRef.current;
      if (mark === null || block === null) {
        return;
      }
      block.style.transform = '';
      const markRect = mark.getBoundingClientRect();
      const blockRect = block.getBoundingClientRect();
      const shift = splashShift({
        markCenter: markRect.top + markRect.height / 2,
        blockBottom: blockRect.bottom,
        viewportHeight: window.innerHeight,
      });
      block.style.transform = shift === 0 ? '' : `translateY(${shift}px)`;
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [markRef, blockRef]);
};
