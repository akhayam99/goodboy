import type { SliceDeps } from '../../slice-types';
import { loadDormantSpend } from './loadDormantSpend';

export const createDormantSpendSlice = ({ set, get }: SliceDeps) => {
  return {
    loadDormantSpend: loadDormantSpend(set, get),
  };
};
