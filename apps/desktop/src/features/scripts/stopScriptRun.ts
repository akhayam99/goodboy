import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';

type Params = {
  readonly sessionId: SessionId;
  readonly scriptKey: string;
};

export const stopScriptRun = async ({ sessionId, scriptKey }: Params): Promise<boolean> => {
  const state = useAppStore.getState();
  try {
    await state.cancelScript(sessionId, scriptKey);
    return true;
  } catch (error) {
    void state.reportError({
      recovery: CHECK_STATE,
      title: "Couldn't stop the script",
      error,
      sessionId,
    });
    return false;
  }
};
