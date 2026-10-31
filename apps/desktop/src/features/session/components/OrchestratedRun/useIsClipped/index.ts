import { useCallback, useEffect, useState } from 'react';

type Clipped = {
  readonly ref: (node: HTMLElement | null) => void;
  readonly isClipped: boolean;
};

export const useIsClipped = (): Clipped => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [isClipped, setIsClipped] = useState(false);
  const ref = useCallback((next: HTMLElement | null) => setNode(next), []);

  useEffect(() => {
    if (node === null) {
      return;
    }
    const measure = () => setIsClipped(node.scrollWidth > node.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, isClipped };
};
