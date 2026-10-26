import { hydrate, retryHydrate } from './hydrate';
import { loadDetectedBrowsers } from './loadDetectedBrowsers';
import { loadDetectedEditors } from './loadDetectedEditors';
import { loadDetectedTerminals } from './loadDetectedTerminals';
import { moveDatabaseAside } from './moveDatabaseAside';
import { quitApp } from './quitApp';
import { retryDatabaseOpen } from './retryDatabaseOpen';
import { restoreNewerDatabaseBackup } from './restoreNewerDatabaseBackup';
import type { SliceDeps } from '../../slice-types';

export const createBootSlice = ({ set, get }: SliceDeps) => {
  return {
    hydrate: hydrate(set, get),
    retryHydrate: retryHydrate(get),
    restoreNewerDatabaseBackup: restoreNewerDatabaseBackup(get),
    quitApp: quitApp(),
    retryDatabaseOpen: retryDatabaseOpen(),
    moveDatabaseAside: moveDatabaseAside(),
    loadDetectedEditors: loadDetectedEditors(set, get),
    loadDetectedBrowsers: loadDetectedBrowsers(set, get),
    loadDetectedTerminals: loadDetectedTerminals({ set, get }),
  };
};
