import { useCallback, useEffect, useState } from 'react';

type RowHeight = {
  readonly ref: (node: HTMLElement | null) => void;
  readonly height: number;
};

export const useRowHeight = (): RowHeight => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);
  const ref = useCallback((next: HTMLElement | null) => setNode(next), []);

  useEffect(() => {
    if (node === null) {
      return;
    }
    const measure = () => setHeight(node.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref, height };
};
