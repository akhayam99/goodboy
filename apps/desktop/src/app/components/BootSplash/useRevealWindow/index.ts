import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from '../../../../shared/lib/isTauriRuntime';

export const useRevealWindow = (): void => {
  useEffect(() => {
    if (!isTauriRuntime()) {
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
