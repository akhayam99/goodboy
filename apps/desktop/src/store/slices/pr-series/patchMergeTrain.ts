import type { SliceDeps } from '../../slice-types';
import type { MergeTrain } from './mergeTrain';

type Params = Pick<SliceDeps, 'set'> & {
  readonly id: string;
  readonly patch: Partial<MergeTrain>;
};

export const patchMergeTrain = ({ set, id, patch }: Params): void => {
  set((state) => {
    const train = state.mergeTrain;
    if (train === null || train.id !== id) {
      return {};
    }
    return { mergeTrain: { ...train, ...patch } };
  });
};
