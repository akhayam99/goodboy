import { useEffect, useState } from 'react';

type Params = {
  readonly node: HTMLElement | null;
};

export const usePaneWidth = ({ node }: Params): number | null => {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
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
  }, [node]);
  return width;
};
