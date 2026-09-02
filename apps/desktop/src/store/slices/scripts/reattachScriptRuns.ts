import { invokeScriptListLive, type ScriptRunRecord } from '../../../features/scripts/scripts';
import { registerScriptRunListeners } from './registerScriptRunListeners';
import type { GetFn, SetFn } from './types';

export const reattachScriptRuns = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    const liveRuns = await invokeScriptListLive();
    set((state) => {
      const scriptRuns = { ...state.scriptRuns };
      for (const live of liveRuns) {
        const record: ScriptRunRecord = {
          status: 'pending',
          result: null,
          runId: live.runId,
          startedAt: live.startedAt,
          ...(live.name === undefined ? {} : { name: live.name }),
        };
        scriptRuns[live.sessionId] = {
          ...scriptRuns[live.sessionId],
          [live.scriptId]: record,
        };
      }
      return { scriptRuns };
    });
    await Promise.all(
      liveRuns.map(async (live) => {
        await registerScriptRunListeners({ set, get, ...live });
      }),
    );
  };
};
