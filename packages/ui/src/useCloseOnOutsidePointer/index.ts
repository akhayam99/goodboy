import { useEffect, type RefObject } from 'react';

type Params = {
  readonly isActive: boolean;
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly close: () => void;
};

export const useCloseOnOutsidePointer = ({ isActive, anchorRef, close }: Params): void => {
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const listener = {
      handleEvent: ({ target }: PointerEvent) => {
        const anchor = anchorRef.current;
        if (anchor !== null && target instanceof Node && anchor.contains(target)) {
          return;
        }
        close();
      },
    };
    document.addEventListener('pointerdown', listener);
    return () => document.removeEventListener('pointerdown', listener);
  }, [isActive, anchorRef, close]);
};
