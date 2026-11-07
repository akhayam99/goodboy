import { useEffect, useRef, type RefObject } from 'react';

type Params = {
  readonly dockRef: RefObject<HTMLDivElement | null>;
  readonly askCount: number;
};

export const useDockAskFocus = ({ dockRef, askCount }: Params): void => {
  const lastCount = useRef(askCount);
  useEffect(() => {
    const hasSettled = askCount < lastCount.current;
    lastCount.current = askCount;
    if (!hasSettled || document.activeElement !== document.body) {
      return;
    }
    dockRef.current
      ?.closest('[data-drop-composer]')
      ?.querySelector<HTMLTextAreaElement>('[data-composer-field] textarea')
      ?.focus({ preventScroll: true });
  }, [askCount, dockRef]);
};
