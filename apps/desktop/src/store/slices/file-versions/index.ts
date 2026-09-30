import { deleteAllSessionFileVersions } from './deleteAllSessionFileVersions';
import { deleteSessionFileVersion } from './deleteSessionFileVersion';
import { loadSessionFileVersions } from './loadSessionFileVersions';
import { restoreSessionFileVersion } from './restoreSessionFileVersion';
import { selectSessionFileVersionPath } from './selectSessionFileVersionPath';
import type { SliceDeps } from '../../slice-types';

export const createFileVersionsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadSessionFileVersions: loadSessionFileVersions(set, get),
    selectSessionFileVersionPath: selectSessionFileVersionPath(set),
    restoreSessionFileVersion: restoreSessionFileVersion(set, get),
    deleteSessionFileVersion: deleteSessionFileVersion(set, get),
    deleteAllSessionFileVersions: deleteAllSessionFileVersions(set),
  };
};
