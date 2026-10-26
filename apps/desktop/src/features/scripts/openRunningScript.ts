import type { RunningScript } from './hooks/useRunningScripts';
import { openScriptOutput } from './openScriptOutput';

type Params = {
  readonly run: RunningScript;
};

export const openRunningScript = async ({ run }: Params): Promise<void> => {
  openScriptOutput({
    sessionId: run.sessionId,
    scriptKey: run.scriptId,
    mountId: run.mountId,
  });
};
