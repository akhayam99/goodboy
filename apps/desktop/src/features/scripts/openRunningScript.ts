import { useAppStore } from '../../store';
import { openLens } from '../session/openLens';
import type { RunningScript } from './hooks/useRunningScripts';

type Params = {
  readonly run: RunningScript;
};

export const openRunningScript = async ({ run }: Params): Promise<void> => {
  await useAppStore.getState().setCurrentSession(run.sessionId);
  openLens({ sessionId: run.sessionId, lens: 'scripts' });
};
