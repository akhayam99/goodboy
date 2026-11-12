import type { SliceDeps } from '../../slice-types';
import { loadVisits } from './loadVisits';

export const createBrowserVisitsSlice = ({ set, get }: SliceDeps) => {
  return {
    loadBrowserVisits: loadVisits({ set, get }),
  };
};
