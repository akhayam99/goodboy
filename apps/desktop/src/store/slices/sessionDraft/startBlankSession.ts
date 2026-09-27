import type { Session, WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export type StartBlankSessionParams = {
  readonly workspaceId: WorkspaceId;
};

export const startBlankSession = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: StartBlankSessionParams): Promise<Session> => {
    const projectId = get().sessionDrafts[workspaceId]?.projectId ?? null;
    const { session } = await get().createSession({
      workspaceId,
      goal: '',
      omitGoalSlot: true,
      ...(projectId !== null && { projectId }),
    });
    set({ openSessionDraftWorkspaceId: null });
    return session;
  };
};
