import { useEffect, useState } from 'react';

const isFocusedNow = (): boolean => document.visibilityState !== 'hidden' && document.hasFocus();

export const useIsWindowFocused = (): boolean => {
  const [isFocused, setIsFocused] = useState(isFocusedNow);

  useEffect(() => {
    const sync = (): void => setIsFocused(isFocusedNow());
    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return isFocused;
};
