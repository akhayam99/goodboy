import { useEffect, useState, type RefObject } from 'react';

type Params = {
  readonly ref: RefObject<HTMLElement | null>;
};

export const usePaneWidth = ({ ref }: Params): number | null => {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (node === null) {
      return;
    }
    const initial = node.getBoundingClientRect().width;
    if (initial > 0) {
      setWidth(initial);
    }
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next !== undefined && next > 0) {
        setWidth(next);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};
