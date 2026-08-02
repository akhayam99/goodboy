import { deleteAllSessionFileVersions } from './deleteAllSessionFileVersions';
import { deleteSessionFileVersion } from './deleteSessionFileVersion';
import { loadSessionFileVersions } from './loadSessionFileVersions';
import { restoreSessionFileVersion } from './restoreSessionFileVersion';
import { selectSessionFileVersionPath } from './selectSessionFileVersionPath';
import type { GetFn, SetFn } from './types';

export const createFileVersionsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadSessionFileVersions: loadSessionFileVersions(set, get),
    selectSessionFileVersionPath: selectSessionFileVersionPath(set),
    restoreSessionFileVersion: restoreSessionFileVersion(set, get),
    deleteSessionFileVersion: deleteSessionFileVersion(set, get),
    deleteAllSessionFileVersions: deleteAllSessionFileVersions(set),
  };
};
