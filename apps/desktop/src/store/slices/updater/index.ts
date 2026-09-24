import { checkForUpdates } from './checkForUpdates';
import { installUpdate } from './installUpdate';
import { relaunchApp } from './relaunchApp';
import type { GetFn, SetFn } from './types';

export const createUpdaterSlice = (set: SetFn, get: GetFn) => {
  return {
    checkForUpdates: checkForUpdates(set, get),
    installUpdate: installUpdate(set, get),
    relaunchApp: relaunchApp(),
  };
};
