import { useEffect, type RefObject } from 'react';

const OPEN_AFTER_MS = 300;

type Params = {
  readonly rootRef: RefObject<HTMLElement | null>;
};

export const useOpenTriggers = ({ rootRef }: Params): void => {
  useEffect(() => {
    const timer = setTimeout(() => {
      const triggers = rootRef.current?.querySelectorAll<HTMLElement>(
        '[data-open-on-mount] button',
      );
      triggers?.forEach((trigger) => trigger.click());
    }, OPEN_AFTER_MS);
    return () => clearTimeout(timer);
  }, [rootRef]);
};
