import type { PrMergeMethod } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import type { MergeTrainCar } from './mergeTrain';

type Params = Pick<SliceDeps, 'set'> & {
  readonly id: string;
  readonly cars: ReadonlyArray<MergeTrainCar>;
  readonly method: PrMergeMethod;
};

export const openMergeTrain = ({ set, id, cars, method }: Params): void => {
  set({
    mergeTrain: {
      id,
      cars,
      method,
      index: 0,
      step: 'merging',
      hasUpdated: false,
      merged: 0,
      isStopRequested: false,
      outcome: null,
    },
  });
};
