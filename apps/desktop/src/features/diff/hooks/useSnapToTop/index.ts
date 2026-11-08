import { useCallback } from 'react';
import { useHoldAppScroll } from '@goodboy/ui';

type Params = {
  readonly element: HTMLElement;
};

export const useSnapToTop = (): ((params: Params) => void) => {
  const holdAppScroll = useHoldAppScroll();
  return useCallback(
    ({ element }: Params) => {
      holdAppScroll();
      element.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    },
    [holdAppScroll],
  );
};
