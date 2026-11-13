import type { SliceDeps } from '../../slice-types';
import type { ActionRunKeyParams } from './types';
import { withoutRun } from './withoutRun';

export const dismissActionRun = ({ set, get }: SliceDeps) => {
  return ({ key }: ActionRunKeyParams): void => {
    const phase = get().actionRuns[key]?.phase;
    if (phase === undefined || phase === 'pending') {
      return;
    }
    set((state) => ({ actionRuns: withoutRun({ runs: state.actionRuns, key }) }));
  };
};
