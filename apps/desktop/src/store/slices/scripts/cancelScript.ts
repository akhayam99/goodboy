import type { SessionId } from '@goodboy/types';
import { invokeScriptCancel, type ScriptRunRecord } from '../../../features/scripts/scripts';
import type { GetFn, SetFn } from './types';

export const cancelScript = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, scriptId: string) => {
    const curr = get().scriptRuns[sessionId]?.[scriptId];
    if (!curr || curr.status !== 'pending') {
      return;
    }
    const cancelled: ScriptRunRecord = { ...curr, status: 'cancelled' };
    set((state) => ({
      scriptRuns: {
        ...state.scriptRuns,
        [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: cancelled },
      },
    }));
    try {
      await invokeScriptCancel(curr.runId);
    } catch (error) {
      set((state) => {
        if (state.scriptRuns[sessionId]?.[scriptId] !== cancelled) {
          return {};
        }
        return {
          scriptRuns: {
            ...state.scriptRuns,
            [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: curr },
          },
        };
      });
      throw error;
    }
  };
};
