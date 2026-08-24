import type { ProjectId, Session, WorkspaceId } from '@goodboy/types';
import { untitledSessionTitle } from './untitledTitle';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
};

export const createUntitledSession = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, projectId }: Input): Promise<{ session: Session }> => {
    const state = get();
    const titles = [
      ...state.sessions.filter((session) => session.workspaceId === workspaceId),
      ...(state.archivedSessions[workspaceId] ?? []),
    ].map((session) => session.goal);
    const title = untitledSessionTitle(titles);
    const result = await state.createSession({
      workspaceId,
      ...(projectId !== undefined ? { projectId } : {}),
      goal: title,
      omitGoalSlot: true,
    });
    set({ pendingTitleFocusSessionId: result.session.id });
    return result;
  };
};
