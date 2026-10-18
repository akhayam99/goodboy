import { checkFolderRestore } from './checkFolderRestore';
import { deleteAllSessionFileVersions } from './deleteAllSessionFileVersions';
import { forgetFolderVersions } from './forgetFolderVersions';
import { loadFolderHistorySize } from './loadFolderHistorySize';
import { loadSessionFolderTurns } from './loadSessionFolderTurns';
import { readFolderVersion } from './readFolderVersion';
import { prepareFolderVersions } from './prepareFolderVersions';
import { pruneFolderVersions } from './pruneFolderVersions';
import { restoreFolderChange } from './restoreFolderChange';
import { retryFolderCapture } from './retryFolderCapture';
import { undoFolderRestore } from './undoFolderRestore';
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
    loadSessionFolderTurns: loadSessionFolderTurns({ set, get }),
    restoreFolderChange: restoreFolderChange({ set, get }),
    undoFolderRestore: undoFolderRestore({ set, get }),
    checkFolderRestore: checkFolderRestore(),
    readFolderVersion: readFolderVersion(),
    loadFolderHistorySize: loadFolderHistorySize({ set, get }),
    retryFolderCapture: retryFolderCapture({ set, get }),
    pruneFolderVersions: pruneFolderVersions({ set, get }),
    prepareFolderVersions: prepareFolderVersions({ set, get }),
    forgetFolderVersions: forgetFolderVersions({ set, get }),
  };
};
