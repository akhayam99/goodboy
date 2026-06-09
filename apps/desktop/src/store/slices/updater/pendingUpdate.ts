import type { Update } from '@tauri-apps/plugin-updater';

// The Update handle returned by `check()` carries the methods to download and
// install. It is a live object, not serializable state, so it lives here in
// module scope instead of in the store.
let pending: Update | null = null;

export const setPendingUpdate = (update: Update | null): void => {
  pending = update;
};

export const getPendingUpdate = (): Update | null => {
  return pending;
};
