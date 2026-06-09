import type { SessionId, WorkspaceScript } from '@goodboy/types';
import type { ScriptResultState } from '../../../features/scripts/scripts';
import { formatError } from '../../../shared/lib/errors';
import type { GetFn, SetFn } from './types';

const runSeqs = new Map<string, number>();

export const runWorkspaceScript = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, script: WorkspaceScript, cwd: string) => {
    const seq = (runSeqs.get(sessionId) ?? 0) + 1;
    runSeqs.set(sessionId, seq);

    const write = (result: ScriptResultState | null) =>
      set((state) => ({
        sessionScriptResult: { ...state.sessionScriptResult, [sessionId]: result },
      }));

    write({ script, status: 'pending', result: null });

    try {
      const result = await get().runScript(sessionId, script.id, cwd);
      if (runSeqs.get(sessionId) !== seq) return;
      write({ script, status: result.exitCode === 0 ? 'ok' : 'error', result });
    } catch (err) {
      if (runSeqs.get(sessionId) !== seq) return;
      write({
        script,
        status: 'error',
        result: { stdout: '', stderr: formatError(err), exitCode: -1 },
      });
    }
  };
};
