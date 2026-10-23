import { useLayoutEffect, useRef, type RefObject } from 'react';
import { canAnimate } from '@goodboy/ui';

type Params = {
  readonly isRunning: boolean;
  readonly totalMs: number;
  readonly startMs: number;
  readonly runKey: string;
};

export const useBeatFill = ({
  isRunning,
  totalMs,
  startMs,
  runKey,
}: Params): RefObject<HTMLSpanElement | null> => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null || !isRunning || totalMs <= 0 || typeof node.animate !== 'function') {
      return;
    }
    if (!canAnimate({ element: node })) {
      return;
    }
    const animation = node.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: totalMs,
      easing: 'linear',
      fill: 'forwards',
    });
    animation.currentTime = Math.min(startMs, totalMs);
    return () => animation.cancel();
  }, [isRunning, totalMs, startMs, runKey]);

  return ref;
};
