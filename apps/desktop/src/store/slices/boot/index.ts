import { hydrate, retryHydrate } from './hydrate';
import { loadDetectedEditors } from './loadDetectedEditors';
import { quitApp } from './quitApp';
import { restoreNewerDatabaseBackup } from './restoreNewerDatabaseBackup';
import type { SliceDeps } from '../../slice-types';

export const createBootSlice = ({ set, get }: SliceDeps) => {
  return {
    hydrate: hydrate(set, get),
    retryHydrate: retryHydrate(get),
    restoreNewerDatabaseBackup: restoreNewerDatabaseBackup(get),
    quitApp: quitApp(),
    loadDetectedEditors: loadDetectedEditors(set, get),
  };
};
