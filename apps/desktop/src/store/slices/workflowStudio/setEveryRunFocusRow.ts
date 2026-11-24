import type { SliceDeps } from '../../slice-types';

export type SetEveryRunFocusRowParams = {
  readonly row: string | null;
};

export const setEveryRunFocusRow = ({ set }: SliceDeps) => {
  return ({ row }: SetEveryRunFocusRowParams): void => {
    set({ everyRunFocusRow: row });
  };
};
