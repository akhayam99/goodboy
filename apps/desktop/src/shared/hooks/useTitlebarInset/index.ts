import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { currentPlatform } from '../../platform';

export const TITLEBAR_INSET_VAR = '--titlebar-inset';
export const TRAFFIC_LIGHT_INSET = '78px';
export const PLAIN_INSET = '12px';

const inTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

type ApplyParams = {
  readonly isFullscreen: boolean;
};

const applyInset = ({ isFullscreen }: ApplyParams): void => {
  document.documentElement.style.setProperty(
    TITLEBAR_INSET_VAR,
    isFullscreen ? PLAIN_INSET : TRAFFIC_LIGHT_INSET,
  );
};

export const useTitlebarInset = (): void => {
  useEffect(() => {
    if (currentPlatform() !== 'darwin' || !inTauri()) {
      return;
    }
    const win = getCurrentWindow();
    let isDisposed = false;
    const sync = async (): Promise<void> => {
      const isFullscreen = await win.isFullscreen().catch(() => false);
      if (isDisposed) {
        return;
      }
      applyInset({ isFullscreen });
    };
    applyInset({ isFullscreen: false });
    void sync();
    const unlisten = win.onResized(() => {
      void sync();
    });
    return () => {
      isDisposed = true;
      document.documentElement.style.removeProperty(TITLEBAR_INSET_VAR);
      void unlisten.then((off) => off()).catch(() => undefined);
    };
  }, []);
};
