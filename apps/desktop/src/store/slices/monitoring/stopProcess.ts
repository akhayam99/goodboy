import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { settleStopping as settle } from './settleStopping';
import type { GetFn, SetFn, StopProcessParams, StopResult } from './types';

export const stopProcess = (set: SetFn, get: GetFn) => {
  return async ({ pid, isForced }: StopProcessParams): Promise<StopResult | null> => {
    set(settle({ pid, progress: 'stopping' }));
    try {
      const result = await invokeCommand<StopResult>('monitor_stop', { pid, force: isForced });
      set(settle({ pid, progress: result.outcome === 'still-running' ? 'still-running' : null }));
      if (result.outcome === 'refused') {
        void get().reportError({
          title: "Couldn't stop the process",
          error: new Error(result.reason ?? 'Goodboy refused to stop it.'),
          severity: 'warning',
        });
      }
      await get().refreshMonitorSnapshot();
      return result;
    } catch (error) {
      set(settle({ pid, progress: null }));
      void get().reportError({ title: "Couldn't stop the process", error });
      return null;
    }
  };
};
