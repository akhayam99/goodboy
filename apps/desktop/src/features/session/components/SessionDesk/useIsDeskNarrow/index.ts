import { useEffect, useState } from 'react';

const DESK_NARROW_PX = 880;

type Params = {
  readonly element: HTMLElement | null;
};

export const useIsDeskNarrow = ({ element }: Params): boolean => {
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    if (element === null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        setIsNarrow(entry.contentRect.width < DESK_NARROW_PX);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return isNarrow;
};
