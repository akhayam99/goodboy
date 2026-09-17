import { getCurrentWindow } from '@tauri-apps/api/window';

const inTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const closePrintWindow = async (): Promise<void> => {
  if (!inTauri()) {
    return;
  }
  await getCurrentWindow()
    .close()
    .catch(() => undefined);
};
