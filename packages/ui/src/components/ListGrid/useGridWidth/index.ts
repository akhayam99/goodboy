import { useLayoutEffect, useState, type RefObject } from 'react';

type Params = {
  readonly ref: RefObject<HTMLElement | null>;
  readonly isWatched: boolean;
};

export const useGridWidth = ({ ref, isWatched }: Params): number => {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null || !isWatched) {
      return undefined;
    }
    const measure = () => setWidth(Math.round(element.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, isWatched]);
  return width;
};
