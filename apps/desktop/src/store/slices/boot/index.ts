import { hydrate, retryHydrate } from './hydrate';
import { loadDetectedEditors } from './loadDetectedEditors';
import { quitApp } from './quitApp';
import { restoreNewerDatabaseBackup } from './restoreNewerDatabaseBackup';
import type { GetFn, SetFn } from './types';

export const createBootSlice = (set: SetFn, get: GetFn) => {
  return {
    hydrate: hydrate(set, get),
    retryHydrate: retryHydrate(get),
    restoreNewerDatabaseBackup: restoreNewerDatabaseBackup(get),
    quitApp: quitApp(),
    loadDetectedEditors: loadDetectedEditors(set, get),
  };
};
