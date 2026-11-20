import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { NOTHING_CHANGED } from '../../store/slices/notifications/errorRecovery';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly body: string;
};

export const duplicateScript = async ({
  workspaceId,
  sessionId,
  projectId,
  name,
  body,
}: Params): Promise<boolean> => {
  const state = useAppStore.getState();
  try {
    await state.saveScript({ workspaceId, projectId, name: `${name} copy`, body });
    return true;
  } catch (error) {
    void state.reportError({
      title: `Couldn't duplicate ${name}`,
      error,
      recovery: NOTHING_CHANGED,
      sessionId,
      retry: () => duplicateScript({ workspaceId, sessionId, projectId, name, body }),
    });
    return false;
  }
};
