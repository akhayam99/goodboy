import { useEffect, useRef, useState } from 'react';

export type PlayPhase = 'idle' | 'run' | 'done';

type Options = {
  readonly threshold?: number;
  readonly duration?: number;
};

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
const DEFAULT_THRESHOLD = 0.35;
const DEFAULT_DURATION = 2400;

const readIsReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_QUERY).matches;

export const usePlayOnce = <T extends Element = HTMLElement>({
  threshold = DEFAULT_THRESHOLD,
  duration = DEFAULT_DURATION,
}: Options = {}) => {
  const ref = useRef<T | null>(null);
  const [isReduced] = useState(readIsReduced);
  const [phase, setPhase] = useState<PlayPhase>(isReduced ? 'done' : 'idle');

  useEffect(() => {
    const node = ref.current;
    if (isReduced || phase !== 'idle' || node === null) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
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
  }, [isReduced, phase, threshold]);

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

type LoopOptions = {
  readonly holds: ReadonlyArray<number>;
  readonly threshold?: number;
};

export const useStepLoop = <T extends Element = HTMLElement>({
  holds,
  threshold = 0.25,
}: LoopOptions) => {
  const ref = useRef<T | null>(null);
  const last = holds.length - 1;
  const [isReduced] = useState(readIsReduced);
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(isReduced ? last : 0);

  useEffect(() => {
    const node = ref.current;
    if (isReduced || node === null) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setStep(last);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry !== undefined) {
          setIsVisible(entry.isIntersecting);
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isReduced, last, threshold]);

  useEffect(() => {
    if (isReduced || !isVisible) {
      return;
    }
    const timer = window.setTimeout(
      () => setStep((current) => (current >= last ? 0 : current + 1)),
      holds[step],
    );
    return () => window.clearTimeout(timer);
  }, [isReduced, isVisible, step, last, holds]);

  return { ref, step, isReduced };
};
