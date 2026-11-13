import type { SliceDeps } from '../../slice-types';
import type { ClaimActionRunParams } from './types';

let nextToken = 0;

export const claimActionRun = ({ set, get }: SliceDeps) => {
  return ({ key, sessionId = null, actionId, choice }: ClaimActionRunParams): number | null => {
    if (get().actionRuns[key]?.phase === 'pending') {
      return null;
    }
    nextToken += 1;
    const token = nextToken;
    set((state) => ({
      actionRuns: {
        ...state.actionRuns,
        [key]: {
          key,
          sessionId,
          actionId,
          choice,
          phase: 'pending',
          message: null,
          error: null,
          startedAt: Date.now(),
          token,
        },
      },
    }));
    return token;
  };
};
