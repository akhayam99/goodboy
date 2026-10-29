import { setBranchFilesFolder } from './setBranchFilesFolder';
import type { SliceDeps } from '../../slice-types';

export const createBranchFilesFilterSlice = ({ set }: SliceDeps) => ({
  setBranchFilesFolder: setBranchFilesFolder({ set }),
});
