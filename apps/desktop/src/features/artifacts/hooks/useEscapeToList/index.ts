import { useEffect, useRef } from 'react';

type Params = {
  readonly isActive: boolean;
  readonly onEscape: () => void;
};

const isTextEntry = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

export const useEscapeToList = ({ isActive, onEscape }: Params): void => {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!isActive) {
      return;
    }
    let pending: ReturnType<typeof setTimeout> | null = null;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || isTextEntry(event.target)) {
        return;
      }
      pending = setTimeout(() => {
        pending = null;
        if (!event.defaultPrevented) {
          onEscapeRef.current();
        }
      }, 0);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (pending !== null) {
        clearTimeout(pending);
      }
    };
  }, [isActive]);
};
