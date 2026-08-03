import { useEffect, useState } from 'react';

export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

export const useCycle = (length: number, ms: number, active: boolean) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const id = window.setInterval(() => setIndex((prev) => (prev + 1) % length), ms);
    return () => window.clearInterval(id);
  }, [active, length, ms]);
  return index;
};
