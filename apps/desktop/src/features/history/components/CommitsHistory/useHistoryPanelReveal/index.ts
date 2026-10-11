import { useEffect, useState } from 'react';

type Params = {
  readonly isOpen: boolean;
};

const REVEAL_MS = 200;

const prefersReducedMotion = () =>
  typeof window === 'undefined' ||
  typeof window.matchMedia !== 'function' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useHistoryPanelReveal = ({ isOpen }: Params) => {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isExpanded, setIsExpanded] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      if (prefersReducedMotion()) {
        setIsExpanded(true);
        return;
      }
      const frame = requestAnimationFrame(() => setIsExpanded(true));
      return () => cancelAnimationFrame(frame);
    }
    setIsExpanded(false);
    if (prefersReducedMotion()) {
      setIsMounted(false);
      return;
    }
    const timer = setTimeout(() => setIsMounted(false), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  return { isMounted, isExpanded };
};
