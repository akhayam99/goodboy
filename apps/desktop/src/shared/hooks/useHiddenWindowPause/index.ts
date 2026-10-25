import { useEffect } from 'react';

const HIDDEN_ATTRIBUTE = 'data-window-hidden';

export const useHiddenWindowPause = (): void => {
  useEffect(() => {
    const root = document.documentElement;
    const sync = (): void => {
      if (document.visibilityState === 'hidden') {
        root.setAttribute(HIDDEN_ATTRIBUTE, '');
        return;
      }
      root.removeAttribute(HIDDEN_ATTRIBUTE);
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      root.removeAttribute(HIDDEN_ATTRIBUTE);
    };
  }, []);
};
