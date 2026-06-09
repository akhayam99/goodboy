import type { SessionId, WorkspaceScriptId } from '@goodboy/types';
import { invokeScriptCancel, type ScriptRunRecord } from '../../../features/scripts/scripts';
import type { GetFn, SetFn } from './types';

export const cancelScript = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, scriptId: WorkspaceScriptId) => {
    const curr = get().scriptRuns[sessionId]?.[scriptId];
    if (!curr || curr.status !== 'pending') return;
    const cancelled: ScriptRunRecord = { ...curr, status: 'cancelled' };
    set((state) => ({
      scriptRuns: {
        ...state.scriptRuns,
        [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: cancelled },
      },
    }));
    await invokeScriptCancel(curr.runId);
  };
};
