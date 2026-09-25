import { exit } from '@tauri-apps/plugin-process';

export const quitApp = () => {
  return async (): Promise<void> => {
    await exit(0);
  };
};
