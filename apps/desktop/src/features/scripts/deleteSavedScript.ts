import type { ProjectScriptId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { NOTHING_CHANGED } from '../../store/slices/notifications/errorRecovery';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly savedId: ProjectScriptId;
  readonly name: string;
};

export const deleteSavedScript = async ({
  workspaceId,
  sessionId,
  savedId,
  name,
}: Params): Promise<boolean> => {
  const state = useAppStore.getState();
  try {
    await state.deleteScript(savedId, workspaceId);
    return true;
  } catch (error) {
    void state.reportError({
      title: `Couldn't delete ${name}`,
      error,
      recovery: NOTHING_CHANGED,
      sessionId,
      retry: () => deleteSavedScript({ workspaceId, sessionId, savedId, name }),
    });
    return false;
  }
};
