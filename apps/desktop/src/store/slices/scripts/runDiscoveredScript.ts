import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  runAdhocScript,
  type ScriptRunRecord,
  type ScriptRunResult,
} from '../../../features/scripts/scripts';
import { registerScriptRunListeners } from './registerScriptRunListeners';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly scriptId: string;
  readonly name: string;
  readonly command: string;
  readonly cwd: string;
  readonly cols?: number;
  readonly rows?: number;
};

type WriteRunParams = {
  readonly record: ScriptRunRecord;
};

export const runDiscoveredScript = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    scriptId,
    name,
    command,
    cwd,
    cols = 220,
    rows = 50,
  }: Params): Promise<ScriptRunResult> => {
    const runId = crypto.randomUUID();
    const startedAt = Date.now();
    const writeRun = ({ record }: WriteRunParams): void => {
      set((state) => ({
        scriptRuns: {
          ...state.scriptRuns,
          [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: record },
        },
      }));
    };
    writeRun({ record: { status: 'pending', result: null, runId, startedAt, name } });
    const registered = await registerScriptRunListeners({
      set,
      get,
      sessionId,
      scriptId,
      runId,
      startedAt,
      name,
    });
    try {
      await runAdhocScript({
        scriptId,
        name,
        body: command,
        runId,
        sessionId,
        cwd,
        cols,
        rows,
      });
    } catch (caughtError) {
      registered.dispose();
      const result: ScriptRunResult = {
        stdout: '',
        stderr: formatError(caughtError),
        exitCode: -1,
      };
      writeRun({ record: { status: 'error', result, runId, startedAt, name } });
      return result;
    }
    return registered.result;
  };
};
