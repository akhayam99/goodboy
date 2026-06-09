import type { Update } from '@tauri-apps/plugin-updater';

let pending: Update | null = null;

export const setPendingUpdate = (update: Update | null): void => {
  pending = update;
};

export const getPendingUpdate = (): Update | null => {
  return pending;
};
