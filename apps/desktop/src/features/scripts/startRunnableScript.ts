import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { selectWritableMounts } from '../../store/slices/project-mounts/selectors';
import type { RunnableScript } from './buildSessionScripts';
import { discoveredScriptCwd, type ScriptRunResult } from './scripts';

type Params = {
  readonly sessionId: SessionId;
  readonly script: RunnableScript;
  readonly mountId: MountId;
  readonly worktreePath: string;
};

export const startRunnableScript = ({
  sessionId,
  script,
  mountId,
  worktreePath,
}: Params): Promise<ScriptRunResult> => {
  const state = useAppStore.getState();
  const liveRecord = state.scriptRuns[sessionId]?.[script.savedId ?? script.key];
  if (liveRecord !== undefined && liveRecord.status === 'pending') {
    const elsewhere =
      liveRecord.mountId === undefined || liveRecord.mountId === mountId
        ? undefined
        : selectWritableMounts({ state, sessionId }).find(
            (mount) => mount.mountId === liveRecord.mountId,
          );
    const where =
      elsewhere === undefined || elsewhere.branch === '' ? '' : ` on ${elsewhere.branch}`;
    return Promise.resolve({ stdout: '', stderr: `Already running${where}`, exitCode: -1 });
  }
  if (script.savedId !== null) {
    return state.runScript({ sessionId, scriptId: script.savedId, mountId });
  }
  return state.runDiscoveredScript({
    sessionId,
    scriptId: script.key,
    name: script.name,
    command: script.invocation,
    cwd: discoveredScriptCwd({ worktreePath, relDir: script.relDir }),
    mountId,
  });
};
