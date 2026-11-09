import type { SliceDeps } from '../../slice-types';
import type { FinishActionRunParams } from './types';
import { withoutRun } from './withoutRun';

export const finishActionRun = ({ set, get }: SliceDeps) => {
  return ({ key, token, result }: FinishActionRunParams): boolean => {
    const current = get().actionRuns[key];
    if (current === undefined || current.token !== token || current.phase !== 'pending') {
      return false;
    }
    if (result.kind === 'silent') {
      set((state) => ({ actionRuns: withoutRun({ runs: state.actionRuns, key }) }));
      return true;
    }
    set((state) => ({
      actionRuns: {
        ...state.actionRuns,
        [key]: {
          ...current,
          phase: result.kind,
          message: result.message,
          error: result.kind === 'failed' ? result.error : null,
        },
      },
    }));
    return true;
  };
};
