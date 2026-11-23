import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly id: string;
};

export const dismissMergeTrain =
  ({ set }: Pick<SliceDeps, 'set'>) =>
  ({ id }: Params): void => {
    set((state) => {
      const train = state.mergeTrain;
      if (train === null || train.id !== id || train.outcome === null) {
        return {};
      }
      return { mergeTrain: null };
    });
  };
