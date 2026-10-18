import type { RebaseAllRunInput, SetFn } from './types';

export const dismissRebaseAll = (set: SetFn) => {
  return ({ sessionId, runId }: RebaseAllRunInput): void => {
    set((state) => {
      const run = state.rebaseAllRuns[sessionId];
      if (
        run === undefined ||
        run.id !== runId ||
        run.phase === 'running' ||
        run.phase === 'handing'
      ) {
        return {};
      }
      const { [sessionId]: _dropped, ...rest } = state.rebaseAllRuns;
      return { rebaseAllRuns: rest };
    });
  };
};
