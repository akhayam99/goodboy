import { useEffect, useState } from 'react';
import { isDeskColumnFolded } from '@goodboy/ui';

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
        setIsNarrow(isDeskColumnFolded({ bodyWidth: entry.contentRect.width }));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return isNarrow;
};
