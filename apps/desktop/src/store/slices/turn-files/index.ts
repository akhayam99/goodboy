import { loadTurnFiles } from './loadTurnFiles';
import type { SliceDeps } from '../../slice-types';

export const createTurnFilesSlice = ({ set, get }: SliceDeps) => {
  return {
    loadTurnFiles: loadTurnFiles({ set, get }),
  };
};
