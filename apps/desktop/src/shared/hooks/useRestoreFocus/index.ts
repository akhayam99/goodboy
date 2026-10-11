import { useEffect, useRef } from 'react';

type Params = {
  readonly isOpen: boolean;
};

const isUsable = (element: Element | null): element is HTMLElement =>
  element instanceof HTMLElement && element !== document.body;

export const useRestoreFocus = ({ isOpen }: Params): void => {
  const originRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      originRef.current = isUsable(document.activeElement) ? document.activeElement : null;
      return;
    }
    const origin = originRef.current;
    originRef.current = null;
    if (origin === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (origin.isConnected && !isUsable(document.activeElement)) {
        origin.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);
};
