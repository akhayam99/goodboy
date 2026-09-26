import { applyUpdate } from './applyUpdate';
import { checkForUpdates } from './checkForUpdates';
import { downloadUpdate } from './downloadUpdate';
import { relaunchApp } from './relaunchApp';
import { setUpdateQueuedUntilIdle } from './setUpdateQueuedUntilIdle';
import type { GetFn, SetFn } from './types';

export const createUpdaterSlice = (set: SetFn, get: GetFn) => {
  return {
    checkForUpdates: checkForUpdates(set, get),
    downloadUpdate: downloadUpdate(set, get),
    applyUpdate: applyUpdate(set, get),
    setUpdateQueuedUntilIdle: setUpdateQueuedUntilIdle(set),
    relaunchApp: relaunchApp(),
  };
};
