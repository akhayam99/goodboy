import { useLayoutEffect, useRef, type RefObject } from 'react';

type Params = {
  readonly ref: RefObject<HTMLElement | null>;
  readonly isFloating: boolean;
};

export const useSnapAfterFloat = ({ ref, isFloating }: Params): void => {
  const wasFloatingRef = useRef(isFloating);
  useLayoutEffect(() => {
    const wasFloating = wasFloatingRef.current;
    wasFloatingRef.current = isFloating;
    const element = ref.current;
    if (!wasFloating || isFloating || element === null) {
      return;
    }
    element.style.setProperty('transition-property', 'none');
    element.getBoundingClientRect();
    element.style.removeProperty('transition-property');
  }, [ref, isFloating]);
};
