import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

const inTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const useRevealWindow = (): void => {
  useEffect(() => {
    if (!inTauri()) {
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        void getCurrentWindow()
          .show()
          .catch(() => false);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);
};
