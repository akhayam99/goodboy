import { checkForUpdates } from './checkForUpdates';
import { installUpdate } from './installUpdate';
import type { GetFn, SetFn } from './types';

export function createUpdaterSlice(set: SetFn, get: GetFn) {
  return {
    checkForUpdates: checkForUpdates(set, get),
    installUpdate: installUpdate(set, get),
  };
}
