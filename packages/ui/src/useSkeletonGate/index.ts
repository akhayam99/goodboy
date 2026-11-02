import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../prefersReducedMotion';
import { SKELETON_FADE_MS, SKELETON_HOLD_MS, SKELETON_SHOW_AFTER_MS } from '../motionTimings';

export type SkeletonGatePhase = 'waiting' | 'skeleton' | 'fading' | 'ready';

type Params = {
  readonly gateKey: string;
  readonly isLoaded: boolean;
};

type GateState = {
  readonly gateKey: string;
  readonly phase: SkeletonGatePhase;
};

const startOf = ({ gateKey, isLoaded }: Params): GateState => ({
  gateKey,
  phase: isLoaded ? 'ready' : 'waiting',
});

export const useSkeletonGate = ({ gateKey, isLoaded }: Params): SkeletonGatePhase => {
  const [state, setState] = useState<GateState>(() => startOf({ gateKey, isLoaded }));
  const shownAtRef = useRef(0);

  let current = state;
  if (state.gateKey !== gateKey) {
    current = startOf({ gateKey, isLoaded });
    setState(current);
  }
  if (current.phase === 'waiting' && isLoaded) {
    current = { gateKey, phase: 'ready' };
    setState(current);
  }
  const { phase } = current;

  useEffect(() => {
    if (phase === 'waiting') {
      const timer = window.setTimeout(() => {
        shownAtRef.current = performance.now();
        setState({ gateKey, phase: 'skeleton' });
      }, SKELETON_SHOW_AFTER_MS);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'skeleton' && isLoaded) {
      const remaining = Math.max(0, shownAtRef.current + SKELETON_HOLD_MS - performance.now());
      const timer = window.setTimeout(() => {
        setState({ gateKey, phase: prefersReducedMotion() ? 'ready' : 'fading' });
      }, remaining);
      return () => window.clearTimeout(timer);
    }
    if (phase === 'fading') {
      const timer = window.setTimeout(
        () => setState({ gateKey, phase: 'ready' }),
        SKELETON_FADE_MS,
      );
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase, isLoaded, gateKey]);

  return phase;
};
