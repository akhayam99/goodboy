import { readCheckLog } from './readCheckLog';
import type { SliceDeps } from '../../slice-types';

export const createChecksLogSlice = ({ set, get }: SliceDeps) => {
  return {
    readCheckLog: readCheckLog({ set, get }),
  };
};
