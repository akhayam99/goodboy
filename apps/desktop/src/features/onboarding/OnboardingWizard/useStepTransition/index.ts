import { useCallback, useEffect, useState } from 'react';

type StepDirection = 'forward' | 'back';

export const STEP_TRANSITION_MS = 240;
const REDUCED_STEP_TRANSITION_MS = 80;
export const OUTGOING_FALLBACK_MS = 300;

type Params<T extends string> = {
  readonly step: T;
  readonly order: ReadonlyArray<T>;
};

type Swap<T extends string> = {
  readonly current: T;
  readonly previous: T | null;
  readonly direction: StepDirection;
  readonly generation: number;
};

export type StepTransitionState<T extends string> = {
  readonly current: T;
  readonly outgoing: T | null;
  readonly direction: StepDirection;
  readonly generation: number;
  readonly isTransitioning: boolean;
  readonly removeOutgoing: () => void;
};

const prefersReducedMotion = (): boolean => {
  if (typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const directionOf = <T extends string>({
  order,
  from,
  to,
}: {
  readonly order: ReadonlyArray<T>;
  readonly from: T;
  readonly to: T;
}): StepDirection => (order.indexOf(to) < order.indexOf(from) ? 'back' : 'forward');

export const useStepTransition = <T extends string>({
  step,
  order,
}: Params<T>): StepTransitionState<T> => {
  const [swap, setSwap] = useState<Swap<T>>({
    current: step,
    previous: null,
    direction: 'forward',
    generation: 0,
  });
  const [settledGeneration, setSettledGeneration] = useState(0);
  const [removedGeneration, setRemovedGeneration] = useState(0);

  if (swap.current !== step) {
    setSwap({
      current: step,
      previous: swap.current,
      direction: directionOf({ order, from: swap.current, to: step }),
      generation: swap.generation + 1,
    });
  }

  const { generation } = swap;

  useEffect(() => {
    if (generation === 0) {
      return;
    }
    const duration = prefersReducedMotion() ? REDUCED_STEP_TRANSITION_MS : STEP_TRANSITION_MS;
    const settle = window.setTimeout(() => setSettledGeneration(generation), duration);
    const fallback = window.setTimeout(
      () => setRemovedGeneration(generation),
      OUTGOING_FALLBACK_MS,
    );
    return () => {
      window.clearTimeout(settle);
      window.clearTimeout(fallback);
    };
  }, [generation]);

  const removeOutgoing = useCallback(() => setRemovedGeneration(generation), [generation]);

  return {
    current: swap.current,
    outgoing: removedGeneration === generation ? null : swap.previous,
    direction: swap.direction,
    generation,
    isTransitioning: generation !== settledGeneration,
    removeOutgoing,
  };
};
