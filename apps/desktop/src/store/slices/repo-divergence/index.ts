import type { SliceDeps } from '../../slice-types';
import { checkRepoDivergence } from './checkRepoDivergence';
import { pullRepoBases } from './pullRepoBases';
import type { RepoDivergenceSlice } from './types';

export const createRepoDivergenceSlice = ({ set, get }: SliceDeps): RepoDivergenceSlice => ({
  checkRepoDivergence: checkRepoDivergence(set, get),
  pullRepoBases: pullRepoBases(set, get),
});
