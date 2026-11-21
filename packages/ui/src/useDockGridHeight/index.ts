import { useEffect, useState, type RefObject } from 'react';

type Params = {
  readonly gridRef: RefObject<HTMLDivElement | null>;
};

export const useDockGridHeight = ({ gridRef }: Params): number | null => {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const node = gridRef.current;
    if (node === null) {
      return;
    }
    setHeight(node.clientHeight);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (typeof height === 'number' && Number.isFinite(height)) {
        setHeight(height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [gridRef]);
  return height;
};
