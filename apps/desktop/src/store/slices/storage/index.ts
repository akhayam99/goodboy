import { checkStorageNudge } from './checkStorageNudge';
import { deleteStorageArtifacts } from './deleteStorageArtifacts';
import { keepStorageArtifact } from './keepStorageArtifact';
import { keepStorageFolder } from './keepStorageFolder';
import { loadStorage } from './loadStorage';
import { loadStorageArtifacts } from './loadStorageArtifacts';
import { measureStorageSizes } from './measureStorageSizes';
import { openStorageArtifact } from './openStorageArtifact';
import { pruneArchivedTranscripts } from './pruneArchivedTranscripts';
import { removeStorageFolders } from './removeStorageFolders';
import { scanStorageRepository } from './scanStorageRepository';
import type { GetFn, SetFn, StorageFocus } from './types';

export const createStorageSlice = (set: SetFn, get: GetFn) => {
  return {
    loadStorage: loadStorage(set, get),
    loadStorageArtifacts: loadStorageArtifacts(set, get),
    measureStorageSizes: measureStorageSizes(set, get),
    pruneArchivedTranscripts: pruneArchivedTranscripts(set, get),
    removeStorageFolders: removeStorageFolders(set, get),
    keepStorageFolder: keepStorageFolder(set, get),
    keepStorageArtifact: keepStorageArtifact(set, get),
    deleteStorageArtifacts: deleteStorageArtifacts(set, get),
    openStorageArtifact: openStorageArtifact(set, get),
    scanStorageRepository: scanStorageRepository(set, get),
    checkStorageNudge: checkStorageNudge(set, get),
    focusStorage: (focus: StorageFocus | null) => set({ storageFocus: focus }),
    dismissStorageOutcome: () => set({ storageOutcome: null }),
  };
};
