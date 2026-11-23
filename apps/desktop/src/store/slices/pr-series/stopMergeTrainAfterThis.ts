import type { SliceDeps } from '../../slice-types';

export const stopMergeTrainAfterThis =
  ({ set }: Pick<SliceDeps, 'set'>) =>
  (): boolean => {
    let isStopping = false;
    set((state) => {
      const train = state.mergeTrain;
      if (train === null || train.outcome !== null || train.isStopRequested) {
        return {};
      }
      isStopping = true;
      return { mergeTrain: { ...train, isStopRequested: true } };
    });
    return isStopping;
  };
