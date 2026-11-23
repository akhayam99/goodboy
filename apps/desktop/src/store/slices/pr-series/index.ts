import { createPrSeries } from './createPrSeries';
import { dismissMergeTrain } from './dismissMergeTrain';
import { loadPrSeries } from './loadPrSeries';
import { mergeSeriesInOrder } from './mergeSeriesInOrder';
import { setPrSeriesMember } from './setPrSeriesMember';
import { startMergeTrain } from './startMergeTrain';
import { stopMergeTrainAfterThis } from './stopMergeTrainAfterThis';
import type { SliceDeps } from '../../slice-types';

export { prSeriesInitialState } from './state';

export const createPrSeriesSlice = ({ set, get }: SliceDeps) => {
  return {
    createPrSeries: createPrSeries(set, get),
    setPrSeriesMember: setPrSeriesMember(set, get),
    loadPrSeries: loadPrSeries(set, get),
    mergeSeriesInOrder: mergeSeriesInOrder({ get }),
    startMergeTrain: startMergeTrain({ set, get }),
    stopMergeTrainAfterThis: stopMergeTrainAfterThis({ set }),
    dismissMergeTrain: dismissMergeTrain({ set }),
  };
};
