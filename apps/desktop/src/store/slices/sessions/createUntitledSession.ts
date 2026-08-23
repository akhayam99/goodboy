import type { Session, WorkspaceId } from '@goodboy/types';
import type { CreatedWorktree } from '../../../features/worktree/worktree';
import { untitledSessionTitle } from './untitledTitle';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
};

export const createUntitledSession = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
  }: Input): Promise<{ session: Session; worktree: CreatedWorktree }> => {
    const state = get();
    const titles = [
      ...state.sessions.filter((session) => session.workspaceId === workspaceId),
      ...(state.archivedSessions[workspaceId] ?? []),
    ].map((session) => session.goal);
    const title = untitledSessionTitle(titles);
    const result = await state.createSession({ workspaceId, goal: title, omitGoalSlot: true });
    set({ pendingTitleFocusSessionId: result.session.id });
    return result;
  };
};
