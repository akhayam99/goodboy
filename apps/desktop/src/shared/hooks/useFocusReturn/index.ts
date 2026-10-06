import { useEffect, useState, type RefObject } from 'react';

const FALLBACK_SELECTOR = '[data-focus-return]';

const activeElement = (): HTMLElement | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
};

const isFocusLost = (): boolean => activeElement() === null;

type Params = {
  readonly rootRef: RefObject<HTMLElement | null>;
};

export const useFocusReturn = ({ rootRef }: Params): void => {
  const [trigger] = useState(activeElement);

  useEffect(() => {
    const root = rootRef.current;
    root?.scrollIntoView?.({ block: 'nearest' });
    const fallback = root?.closest<HTMLElement>(FALLBACK_SELECTOR) ?? null;
    return () => {
      if (!isFocusLost()) {
        return;
      }
      const target = trigger !== null && trigger.isConnected ? trigger : fallback;
      if (target === null || !target.isConnected) {
        return;
      }
      target.focus({ preventScroll: true });
    };
  }, [rootRef, trigger]);
};
