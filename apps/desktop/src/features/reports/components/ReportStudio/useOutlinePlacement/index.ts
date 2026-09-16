import { useEffect, useState, type RefObject } from 'react';

export type OutlinePlacement = 'aside' | 'inline';

export const OUTLINE_ASIDE_MIN_WIDTH = 680;

export const useOutlinePlacement = ({
  containerRef,
}: {
  readonly containerRef: RefObject<HTMLElement | null>;
}): OutlinePlacement => {
  const [placement, setPlacement] = useState<OutlinePlacement>('aside');

  useEffect(() => {
    const node = containerRef.current;
    if (node === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const sync = (width: number) => {
      if (width <= 0) {
        return;
      }
      setPlacement(width >= OUTLINE_ASIDE_MIN_WIDTH ? 'aside' : 'inline');
    };
    sync(node.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        sync(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  return placement;
};
