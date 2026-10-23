import { recordLocalCheck } from './recordLocalCheck';
import type { SliceDeps } from '../../slice-types';

export const createLocalChecksSlice = ({ set }: SliceDeps) => {
  return {
    recordLocalCheck: recordLocalCheck({ set }),
  };
};
