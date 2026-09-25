import { keepStorageFolder } from './keepStorageFolder';
import { loadStorage } from './loadStorage';
import { measureStorageSizes } from './measureStorageSizes';
import { pruneArchivedTranscripts } from './pruneArchivedTranscripts';
import { removeStorageFolders } from './removeStorageFolders';
import { scanStorageRepository } from './scanStorageRepository';
import type { GetFn, SetFn, StorageFocus } from './types';

export type { StorageStats } from './types';

export const createStorageSlice = (set: SetFn, get: GetFn) => {
  return {
    loadStorage: loadStorage(set, get),
    measureStorageSizes: measureStorageSizes(set, get),
    pruneArchivedTranscripts: pruneArchivedTranscripts(set, get),
    removeStorageFolders: removeStorageFolders(set, get),
    keepStorageFolder: keepStorageFolder(set, get),
    scanStorageRepository: scanStorageRepository(set, get),
    focusStorage: (focus: StorageFocus | null) => set({ storageFocus: focus }),
    dismissStorageOutcome: () => set({ storageOutcome: null }),
  };
};
