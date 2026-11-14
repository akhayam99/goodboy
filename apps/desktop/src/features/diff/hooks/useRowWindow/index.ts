import { useEffect, useState, type RefObject } from 'react';

type Params = {
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly isWindowed: boolean;
};

export type RowWindowMeasure = {
  readonly scrollTop: number;
  readonly viewport: number;
};

export const useRowWindow = ({ viewportRef, isWindowed }: Params): RowWindowMeasure => {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    const element = viewportRef.current;
    if (element === null || !isWindowed) {
      return;
    }
    const measure = () => {
      setScrollTop(element.scrollTop);
      setViewport(element.clientHeight);
    };
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [isWindowed, viewportRef]);

  return { scrollTop, viewport };
};
