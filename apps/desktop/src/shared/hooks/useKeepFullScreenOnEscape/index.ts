import { useEffect } from 'react';
import { currentPlatform } from '../../platform';

const inTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const claimUnhandledEscape = (event: KeyboardEvent): void => {
  if (event.defaultPrevented) {
    return;
  }
  event.preventDefault();
};

const armLastResort = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || event.isComposing) {
    return;
  }
  window.addEventListener('keydown', claimUnhandledEscape, { once: true });
};

export const useKeepFullScreenOnEscape = (): void => {
  useEffect(() => {
    if (currentPlatform() !== 'darwin' || !inTauri()) {
      return;
    }
    window.addEventListener('keydown', armLastResort, { capture: true });
    return () => {
      window.removeEventListener('keydown', armLastResort, { capture: true });
      window.removeEventListener('keydown', claimUnhandledEscape);
    };
  }, []);
};
