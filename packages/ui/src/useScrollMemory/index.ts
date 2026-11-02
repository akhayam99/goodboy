import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { recalledScroll } from '../recalledScroll';
import { rememberScroll } from '../rememberScroll';

type Params = {
  readonly memoryKey: string;
  readonly isLoaded: boolean;
  readonly viewportRef: RefObject<HTMLElement | null>;
};

export const useScrollMemory = ({ memoryKey, isLoaded, viewportRef }: Params): (() => void) => {
  const restoredKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!isLoaded || restoredKeyRef.current === memoryKey) {
      return;
    }
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    restoredKeyRef.current = memoryKey;
    const top = recalledScroll({ memoryKey });
    if (top !== null) {
      viewport.scrollTop = top;
    }
  }, [isLoaded, memoryKey, viewportRef]);

  return useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport === null || restoredKeyRef.current !== memoryKey) {
      return;
    }
    rememberScroll({ memoryKey, top: viewport.scrollTop });
  }, [memoryKey, viewportRef]);
};
