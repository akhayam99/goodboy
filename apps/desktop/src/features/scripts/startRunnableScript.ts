import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
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
