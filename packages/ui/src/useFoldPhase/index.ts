import { useEffect, useState, type RefObject } from 'react';
import { canAnimate } from '../canAnimate';
import { DURATION_BASE_MS } from '../motionTimings';

export type FoldPhase = 'open' | 'folding' | 'folded' | 'unfolding';

type Params = {
  readonly isFolded: boolean;
  readonly frameRef: RefObject<HTMLElement | null>;
};

type NextParams = Params & {
  readonly phase: FoldPhase;
};

const nextPhaseOf = ({ phase, isFolded, frameRef }: NextParams): FoldPhase => {
  if (isFolded && (phase === 'open' || phase === 'unfolding')) {
    return canAnimate({ element: frameRef.current }) ? 'folding' : 'folded';
  }
  if (!isFolded && (phase === 'folded' || phase === 'folding')) {
    return canAnimate({ element: frameRef.current }) ? 'unfolding' : 'open';
  }
  return phase;
};

export const useFoldPhase = ({ isFolded, frameRef }: Params): FoldPhase => {
  const [phase, setPhase] = useState<FoldPhase>(isFolded ? 'folded' : 'open');
  const next = nextPhaseOf({ phase, isFolded, frameRef });
  if (next !== phase) {
    setPhase(next);
  }

  useEffect(() => {
    if (next !== 'folding' && next !== 'unfolding') {
      return;
    }
    const settled: FoldPhase = next === 'folding' ? 'folded' : 'open';
    const timer = window.setTimeout(() => setPhase(settled), DURATION_BASE_MS);
    return () => window.clearTimeout(timer);
  }, [next]);

  return next;
};
