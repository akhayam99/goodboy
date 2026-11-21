import type { MountId, SessionId } from '@goodboy/types';
import type { ScriptRunRecord } from '../../../features/scripts/scripts';
import type { SliceDeps } from '../../slice-types';

type Deps = Pick<SliceDeps, 'set'>;

type Params = {
  readonly sessionId: SessionId;
  readonly scriptId: string;
  readonly name: string;
  readonly mountId: MountId;
  readonly exitCode: number;
  readonly startedAt: number;
};

export const recordTerminalScriptRun = ({ set }: Deps) => {
  return ({ sessionId, scriptId, name, mountId, exitCode, startedAt }: Params): void => {
    set((state) => {
      if (state.scriptRuns[sessionId]?.[scriptId]?.status === 'pending') {
        return {};
      }
      const record: ScriptRunRecord = {
        status: exitCode === 0 ? 'ok' : 'error',
        result: { stdout: '', stderr: '', exitCode },
        runId: crypto.randomUUID(),
        startedAt,
        completedAt: Date.now(),
        name,
        mountId,
      };
      return {
        scriptRuns: {
          ...state.scriptRuns,
          [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: record },
        },
      };
    });
  };
};
