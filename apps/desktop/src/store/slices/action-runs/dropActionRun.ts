import type { SliceDeps } from '../../slice-types';
import type { ActionRunKeyParams } from './types';
import { withoutRun } from './withoutRun';

export const dropActionRun = ({ set }: Pick<SliceDeps, 'set'>) => {
  return ({ key }: ActionRunKeyParams): void => {
    set((state) => ({ actionRuns: withoutRun({ runs: state.actionRuns, key }) }));
  };
};
