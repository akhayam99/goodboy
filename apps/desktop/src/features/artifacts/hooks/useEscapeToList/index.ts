import { useEffect } from 'react';

type Params = {
  readonly isActive: boolean;
  readonly onEscape: () => void;
};

const isTextEntry = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

export const useEscapeToList = ({ isActive, onEscape }: Params): void => {
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || isTextEntry(event.target)) {
        return;
      }
      event.preventDefault();
      onEscape();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, onEscape]);
};
