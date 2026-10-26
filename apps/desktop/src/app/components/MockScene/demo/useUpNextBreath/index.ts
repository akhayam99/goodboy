import { useEffect, useState, type RefObject } from 'react';
import { canAnimate } from '@goodboy/ui';

type Params = {
  readonly targetRef: RefObject<HTMLElement | null>;
  readonly isReady: boolean;
};

const BREATH_MS = 2200;
const BREATH_CYCLES = 3;
const GLOW_FROM = '0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent)';
const GLOW_TO = '0 0 0 6px color-mix(in srgb, var(--color-primary) 28%, transparent)';

export const useUpNextBreath = ({ targetRef, isReady }: Params): boolean => {
  const [isRested, setIsRested] = useState(false);

  useEffect(() => {
    if (!isReady) {
      setIsRested(false);
      return;
    }
    const rest = window.setTimeout(() => setIsRested(true), BREATH_MS * BREATH_CYCLES);
    const target = targetRef.current;
    const breath =
      target !== null && canAnimate({ element: target })
        ? target.animate(
            [{ boxShadow: GLOW_FROM }, { boxShadow: GLOW_TO }, { boxShadow: GLOW_FROM }],
            {
              duration: BREATH_MS,
              iterations: BREATH_CYCLES,
              easing: 'ease-in-out',
            },
          )
        : undefined;
    return () => {
      window.clearTimeout(rest);
      breath?.cancel();
    };
  }, [isReady, targetRef]);

  return isReady && !isRested;
};
