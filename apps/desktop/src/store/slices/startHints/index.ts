import type { SliceDeps } from '../../slice-types';
import { setStartHint } from './setStartHint';
import { settleStartHint } from './settleStartHint';

export const createStartHintsSlice = ({ set }: SliceDeps) => {
  return {
    setStartHint: setStartHint(set),
    settleStartHint: settleStartHint(set),
  };
};
