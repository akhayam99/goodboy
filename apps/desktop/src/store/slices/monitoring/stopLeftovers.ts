import type { GetFn, StopLeftoversParams } from './types';

export const stopLeftovers = (get: GetFn) => {
  return async ({ pids }: StopLeftoversParams): Promise<number> => {
    let stopped = 0;
    for (const pid of pids) {
      const result = await get().stopProcess({ pid, force: false });
      if (result?.outcome === 'stopped') {
        stopped += 1;
      }
    }
    return stopped;
  };
};
