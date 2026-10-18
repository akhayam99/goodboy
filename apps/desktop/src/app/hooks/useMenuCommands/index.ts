import { useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { runMenuCommand } from './runMenuCommand';

const MENU_EVENT = 'goodboy://menu';

type PayloadParams = {
  readonly payload: unknown;
};

const idOf = ({ payload }: PayloadParams): string | null => {
  if (typeof payload !== 'object' || payload === null || !('id' in payload)) {
    return null;
  }
  return typeof payload.id === 'string' ? payload.id : null;
};

const listenToMenu = async (): Promise<() => void> => {
  try {
    return await getCurrentWebviewWindow().listen<unknown>(MENU_EVENT, (event) =>
      runMenuCommand({ id: idOf({ payload: event.payload }) }),
    );
  } catch {
    return () => undefined;
  }
};

export const useMenuCommands = (): void => {
  useEffect(() => {
    let isCurrent = true;
    let stop: () => void = () => undefined;
    void listenToMenu().then((off) => {
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
