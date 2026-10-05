import { useEffect, useState, type RefObject } from 'react';

const NARROW_PANE_PX = 900;

export const useNarrowPane = (ref: RefObject<HTMLElement | null>): boolean => {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      setIsNarrow(width > 0 && width < NARROW_PANE_PX);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isNarrow;
};
