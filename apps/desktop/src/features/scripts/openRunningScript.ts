import { sessionPlace, useAppStore } from '../../store';
import type { RunningScript } from './hooks/useRunningScripts';

type Params = {
  readonly run: RunningScript;
};

export const openRunningScript = async ({ run }: Params): Promise<void> => {
  const state = useAppStore.getState();
  if (state.currentSessionId !== run.sessionId) {
    state.navigate({ to: sessionPlace({ sessionId: run.sessionId }) });
  }
  useAppStore.getState().openDrawer({
    kind: 'scriptRun',
    sessionId: run.sessionId,
    payload: { scriptKey: run.scriptId, mountId: run.mountId },
  });
};
