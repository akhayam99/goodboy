import { useLayoutEffect, type RefObject } from 'react';
import { HEAD_INSET_VAR } from '@goodboy/ui';

type Params = {
  readonly columnRef: RefObject<HTMLElement | null>;
  readonly headRef: RefObject<HTMLElement | null>;
};

export const useHeadInset = ({ columnRef, headRef }: Params): void => {
  useLayoutEffect(() => {
    const column = columnRef.current;
    const head = headRef.current;
    if (column === null || head === null) {
      return;
    }
    const write = () => {
      column.style.setProperty(HEAD_INSET_VAR, `${head.offsetHeight}px`);
    };
    write();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(write);
    observer.observe(head);
    return () => observer.disconnect();
  }, [columnRef, headRef]);
};
