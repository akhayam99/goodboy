import type { Session, WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export type StartBlankSessionParams = {
  readonly workspaceId: WorkspaceId;
};

export const startBlankSession = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId }: StartBlankSessionParams): Promise<Session> => {
    const [projectId, ...additionalProjectIds] = get().sessionDrafts[workspaceId]?.projectIds ?? [];
    const { session } = await get().createSession({
      workspaceId,
      goal: '',
      omitGoalSlot: true,
      ...(projectId !== undefined && { projectId }),
      ...(additionalProjectIds.length > 0 && { additionalProjectIds }),
    });
    set({ openSessionDraftWorkspaceId: null });
    return session;
  };
};
