import { loadTurnFiles } from './loadTurnFiles';
import { refreshTurnFiles } from './refreshTurnFiles';
import type { SliceDeps } from '../../slice-types';

export const createTurnFilesSlice = ({ set, get }: SliceDeps) => {
  return {
    loadTurnFiles: loadTurnFiles({ set, get }),
    refreshTurnFiles: refreshTurnFiles({ set, get }),
  };
};
