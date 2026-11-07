import { setGroupBy } from './setGroupBy';
import type { SliceDeps } from '../../slice-types';

export const createSessionGroupingSlice = ({ set }: SliceDeps) => ({
  setGroupBy: setGroupBy({ set }),
});
