import type { MountId, ProjectScriptId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  invokeScriptRun,
  type ScriptRunRecord,
  type ScriptRunResult,
} from '../../../features/scripts/scripts';
import {
  selectProjectMounts,
  selectUnambiguousProjectMount,
  selectWritableMountPath,
} from '../project-mounts/selectors';
import { registerScriptRunListeners } from './registerScriptRunListeners';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly scriptId: ProjectScriptId;
  readonly mountId?: MountId;
  readonly cols?: number;
  readonly rows?: number;
};

type WriteRunParams = {
  readonly record: ScriptRunRecord;
};

type ResolvedMount = {
  readonly cwd: string;
  readonly mountId: MountId;
};

export const runScript = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, scriptId, mountId, cols = 220, rows = 50 }: Params) => {
    const runId = crypto.randomUUID();
    const startedAt = Date.now();

    const writeRun = ({ record }: WriteRunParams) =>
      set((state) => ({
        scriptRuns: {
          ...state.scriptRuns,
          [sessionId]: { ...state.scriptRuns[sessionId], [scriptId]: record },
        },
      }));

    const mountField = mountId === undefined ? {} : { mountId };
    writeRun({ record: { status: 'pending', result: null, runId, startedAt, ...mountField } });

    const state = get();
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    const script =
      session === undefined
        ? undefined
        : (state.projectScripts[session.workspaceId] ?? []).find(
            (candidate) => candidate.id === scriptId,
          );
    const resolveMount = (): ResolvedMount | null => {
      if (script === undefined) {
        return null;
      }
      if (mountId !== undefined) {
        const cwd = selectWritableMountPath({ state, sessionId, mountId });
        return cwd === null ? null : { cwd, mountId };
      }
      const mount = selectUnambiguousProjectMount({
        state,
        sessionId,
        projectId: script.projectId,
      });
      return mount === null ? null : { cwd: mount.worktreePath, mountId: mount.mountId };
    };
    const resolved = resolveMount();
    if (script === undefined || resolved === null) {
      const project =
        script === undefined
          ? undefined
          : state.projects.find((candidate) => candidate.id === script.projectId);
      const candidateCount =
        script === undefined
          ? 0
          : selectProjectMounts({ state, sessionId, projectId: script.projectId }).length;
      const projectLabel = project?.name ?? 'Script project';
      const unmountedMessage =
        candidateCount > 1
          ? `${projectLabel} has several mounts in this session. Pick the mount to run in.`
          : `${projectLabel} is not mounted in this session`;
      const message =
        script === undefined ? 'Script is not available in this session' : unmountedMessage;
      const result: ScriptRunResult = { stdout: '', stderr: message, exitCode: -1 };
      writeRun({
        record: {
          status: 'error',
          result,
          runId,
          startedAt,
          completedAt: Date.now(),
          ...mountField,
        },
      });
      return result;
    }

    const record = get().scriptRuns[sessionId]?.[scriptId];
    if (record !== undefined && record.runId === runId) {
      writeRun({ record: { ...record, name: script.name, mountId: resolved.mountId } });
    }

    const registered = await registerScriptRunListeners({
      set,
      get,
      sessionId,
      scriptId,
      runId,
      startedAt,
      name: script.name,
      mountId: resolved.mountId,
    });

    try {
      await invokeScriptRun({ scriptId, runId, sessionId, cwd: resolved.cwd, cols, rows });
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
          name: script.name,
          mountId: resolved.mountId,
        },
      });
      return result;
    }

    return registered.result;
  };
};
