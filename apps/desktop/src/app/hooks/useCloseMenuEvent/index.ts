import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const CLOSE_CURRENT_EVENT = 'goodboy://close-current';

const listenToMenu = async (onClose: () => void): Promise<() => void> => {
  try {
    return await getCurrentWebviewWindow().listen(CLOSE_CURRENT_EVENT, onClose);
  } catch {
    return () => undefined;
  }
};

const replayCloseChord = (): void => {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', metaKey: true, cancelable: true }),
  );
};

export const useCloseMenuEvent = (): void => {
  useEffect(() => {
    let isCurrent = true;
    let stop: () => void = () => undefined;
    void listenToMenu(replayCloseChord).then((off) => {
      if (!isCurrent) {
        off();
        return;
      }
      stop = off;
    });
    return () => {
      isCurrent = false;
      stop();
    };
  }, []);
};
