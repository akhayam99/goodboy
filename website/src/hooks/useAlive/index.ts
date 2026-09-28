import { useEffect, useRef, useState, type RefObject } from 'react';

type Params = {
  readonly delays: readonly number[];
};

type Alive = {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly step: number;
};

const VIEW_THRESHOLD = 0.4;
const STILL_ATTRIBUTE = 'data-still';

const isStill = (): boolean => {
  if (typeof window === 'undefined') {
    return true;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return true;
  }
  if (document.documentElement.hasAttribute(STILL_ATTRIBUTE)) {
    return true;
  }
  return typeof IntersectionObserver === 'undefined';
};

export const useAlive = ({ delays }: Params): Alive => {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(() => (isStill() ? delays.length : 0));

  useEffect(() => {
    const node = ref.current;
    if (node === null || isStill()) {
      return;
    }
    const timers: number[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        const isInView = entries.some((entry) => entry.intersectionRatio >= VIEW_THRESHOLD);
        if (!isInView) {
          return;
        }
        observer.disconnect();
        delays.forEach((delay, index) => {
          timers.push(window.setTimeout(() => setStep(index + 1), delay));
        });
      },
      { threshold: VIEW_THRESHOLD },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [delays]);

  return { ref, step };
};
