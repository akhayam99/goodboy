import { useEffect, type RefObject } from 'react';

const OPEN_AFTER_MS = 300;

type Params = {
  readonly rootRef: RefObject<HTMLElement | null>;
  readonly isReady?: boolean;
};

export const useOpenTriggers = ({ rootRef, isReady = true }: Params): void => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const timer = setTimeout(() => {
      const triggers = rootRef.current?.querySelectorAll<HTMLElement>(
        '[data-open-on-mount] button',
      );
      triggers?.forEach((trigger) => trigger.click());
    }, OPEN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [rootRef, isReady]);
};
