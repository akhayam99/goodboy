import {
  brandId,
  type ProjectId,
  type ProjectScriptId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../store';
import { NOTHING_CHANGED } from '../../store/slices/notifications/errorRecovery';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly body: string;
  readonly copyId?: ProjectScriptId;
};

export const duplicateScript = async ({
  workspaceId,
  sessionId,
  projectId,
  name,
  body,
  copyId = brandId<ProjectScriptId>({ value: crypto.randomUUID() }),
}: Params): Promise<boolean> => {
  const state = useAppStore.getState();
  try {
    await state.saveScript({ workspaceId, projectId, id: copyId, name: `${name} copy`, body });
    return true;
  } catch (error) {
    void state.reportError({
      title: `Couldn't duplicate ${name}`,
      error,
      recovery: NOTHING_CHANGED,
      sessionId,
      retry: () => duplicateScript({ workspaceId, sessionId, projectId, name, body, copyId }),
    });
    return false;
  }
};
