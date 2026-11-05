import { useEffect, useRef, useState } from 'react';
import { readIsReduced } from '../readIsReduced';

export type PlayPhase = 'idle' | 'run' | 'done';

type Options = {
  readonly threshold?: number;
  readonly duration?: number;
};

const DEFAULT_THRESHOLD = 0.35;
const DEFAULT_DURATION = 2400;

export const usePlayOnce = <T extends Element = HTMLElement>({
  threshold = DEFAULT_THRESHOLD,
  duration = DEFAULT_DURATION,
}: Options = {}) => {
  const ref = useRef<T | null>(null);
  const [phase, setPhase] = useState<PlayPhase>('idle');

  useEffect(() => {
    const node = ref.current;
    if (phase !== 'idle' || node === null) {
      return;
    }
    if (readIsReduced() || typeof IntersectionObserver === 'undefined') {
      setPhase('done');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase('run');
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [phase, threshold]);

  useEffect(() => {
    if (phase !== 'run') {
      return;
    }
    const timer = window.setTimeout(() => setPhase('done'), duration);
    return () => window.clearTimeout(timer);
  }, [phase, duration]);

  return {
    ref,
    phase,
    isPlaying: phase === 'run',
    hasPlayed: phase !== 'idle',
  };
};
