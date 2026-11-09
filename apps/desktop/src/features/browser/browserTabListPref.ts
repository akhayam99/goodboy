import { STORAGE_KEYS, persistedPref } from '../../shared/lib/storage-keys';

export const browserTabListPref = persistedPref<boolean>({
  key: STORAGE_KEYS.browserTabList,
  parse: JSON.parse,
  fallback: false,
});
