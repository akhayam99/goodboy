import { useLayoutEffect, useRef, type RefObject } from 'react';
import { canAnimate } from '@goodboy/ui';

type Params = {
  readonly isRunning: boolean;
  readonly durationMs: number;
  readonly runKey: string;
};

export const useBeatFill = ({
  isRunning,
  durationMs,
  runKey,
}: Params): RefObject<HTMLSpanElement | null> => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null || !isRunning || typeof node.animate !== 'function') {
      return;
    }
    if (!canAnimate({ element: node })) {
      return;
    }
    const animation = node.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: durationMs,
      easing: 'linear',
      fill: 'forwards',
    });
    return () => animation.cancel();
  }, [isRunning, durationMs, runKey]);

  return ref;
};
