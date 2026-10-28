import { useLayoutEffect, useState, type RefObject } from 'react';
import type { CoachMark } from '../DemoCoachMark';

type Params = {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly targetRef: RefObject<HTMLElement | null>;
  readonly copy: string;
};

type Size = {
  readonly width: number;
  readonly height: number;
};

export type ClosingCoach = {
  readonly coach: CoachMark;
  readonly bounds: Size;
};

export const useClosingCoach = ({
  containerRef,
  targetRef,
  copy,
}: Params): ClosingCoach | undefined => {
  const [closing, setClosing] = useState<ClosingCoach | undefined>(undefined);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const target = targetRef.current;
    if (container === null || target === null) {
      return;
    }
    const measure = () => {
      const box = container.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      setClosing({
        bounds: { width: box.width, height: box.height },
        coach: {
          hintId: 'closing-download',
          copy,
          side: 'right',
          isSideLocked: true,
          rect: {
            x: Math.round(rect.left - box.left),
            y: Math.round(rect.top - box.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          focus: null,
          opened: [],
          isDimmed: false,
          pulse: 0,
        },
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(target);
    return () => observer.disconnect();
  }, [containerRef, targetRef, copy]);

  return closing;
};
