import type { MountId, SessionId } from '@goodboy/types';
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
  readonly mountId?: MountId;
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
    mountId,
    cols = 220,
    rows = 50,
  }: Params): Promise<ScriptRunResult> => {
    const runId = crypto.randomUUID();
    const startedAt = Date.now();
    const mountField = mountId === undefined ? {} : { mountId };
    const writeRun = ({ record }: WriteRunParams): void => {
      set((state) => ({
        scriptRuns: {
          ...state.scriptRuns,
          [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: record },
        },
      }));
    };
    writeRun({
      record: { status: 'pending', result: null, runId, startedAt, name, ...mountField },
    });
    const registered = await registerScriptRunListeners({
      set,
      get,
      sessionId,
      scriptId,
      runId,
      startedAt,
      name,
      ...mountField,
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
      writeRun({
        record: {
          status: 'error',
          result,
          runId,
          startedAt,
          completedAt: Date.now(),
          name,
          ...mountField,
        },
      });
      return result;
    }
    return registered.result;
  };
};
