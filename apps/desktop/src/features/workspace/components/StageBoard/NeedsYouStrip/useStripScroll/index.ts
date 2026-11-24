import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

type Params = {
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly stepPx: number;
  readonly count: number;
};

type Edges = Readonly<{
  isOverflowing: boolean;
  isAtStart: boolean;
  isAtEnd: boolean;
}>;

type ScrollParams = {
  readonly direction: -1 | 1;
};

export type StripScroll = Edges &
  Readonly<{
    measure: () => void;
    scroll: (params: ScrollParams) => void;
  }>;

const EDGE_PX = 1;

const FITS: Edges = { isOverflowing: false, isAtStart: true, isAtEnd: true };

type SameParams = {
  readonly left: Edges;
  readonly right: Edges;
};

const isSame = ({ left, right }: SameParams): boolean =>
  left.isOverflowing === right.isOverflowing &&
  left.isAtStart === right.isAtStart &&
  left.isAtEnd === right.isAtEnd;

export const useStripScroll = ({ viewportRef, stepPx, count }: Params): StripScroll => {
  const [edges, setEdges] = useState<Edges>(FITS);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    const max = viewport.scrollWidth - viewport.clientWidth;
    const next: Edges = {
      isOverflowing: max > EDGE_PX,
      isAtStart: viewport.scrollLeft <= EDGE_PX,
      isAtEnd: viewport.scrollLeft >= max - EDGE_PX,
    };
    setEdges((current) => (isSame({ left: current, right: next }) ? current : next));
  }, [viewportRef]);

  useLayoutEffect(() => {
    measure();
    const viewport = viewportRef.current;
    if (viewport === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measure, viewportRef, count, stepPx]);

  const scroll = useCallback(
    ({ direction }: ScrollParams) => {
      const viewport = viewportRef.current;
      if (viewport === null) {
        return;
      }
      viewport.scrollLeft += direction * stepPx;
      measure();
    },
    [measure, stepPx, viewportRef],
  );

  return { ...edges, measure, scroll };
};
