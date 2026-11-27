import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly isOpen: boolean;
};

export const setCompanionPageOpen = ({ set }: SliceDeps) => {
  return ({ isOpen }: Params): void => {
    set({ isCompanionPageOpen: isOpen });
  };
};
