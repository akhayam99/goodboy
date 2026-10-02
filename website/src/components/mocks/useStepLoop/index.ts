import { useEffect, useRef, useState } from 'react';
import { readIsReduced } from '../readIsReduced';

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
