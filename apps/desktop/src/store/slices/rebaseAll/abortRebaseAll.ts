import type { RebaseAllRunInput, SetFn } from './types';

export const abortRebaseAll = (set: SetFn) => {
  return ({ sessionId, runId }: RebaseAllRunInput): void => {
    set((state) => {
      const run = state.rebaseAllRuns[sessionId];
      if (run === undefined || run.id !== runId || run.phase !== 'running') {
        return {};
      }
      return {
        rebaseAllRuns: { ...state.rebaseAllRuns, [sessionId]: { ...run, isAborted: true } },
      };
    });
  };
};
