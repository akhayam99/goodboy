import { createPrSeries } from './createPrSeries';
import { loadPrSeries } from './loadPrSeries';
import { setPrSeriesMember } from './setPrSeriesMember';
import type { SliceDeps } from '../../slice-types';

export { prSeriesInitialState } from './state';

export const createPrSeriesSlice = ({ set, get }: SliceDeps) => {
  return {
    createPrSeries: createPrSeries(set, get),
    setPrSeriesMember: setPrSeriesMember(set, get),
    loadPrSeries: loadPrSeries(set, get),
  };
};
