import { relaunch } from '@tauri-apps/plugin-process';

export const relaunchApp = () => {
  return async (): Promise<void> => {
    await relaunch();
  };
};
