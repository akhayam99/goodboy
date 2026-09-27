import type { Session } from '@goodboy/types';
import { sessionPlace } from '../navigation/place';
import { isBlankSession } from './isBlankSession';
import type { GetFn, SetFn } from './types';

export const startBlankSession = (set: SetFn, get: GetFn) => {
  return async (): Promise<Session | null> => {
    const state = get();
    const workspaceId = state.currentWorkspaceId;
    if (workspaceId === null) {
      return null;
    }
    const reusable = state.sessions.find(
      (candidate) => candidate.id === state.blankSessionId && candidate.workspaceId === workspaceId,
    );
    if (reusable !== undefined && isBlankSession({ state, sessionId: reusable.id })) {
      state.navigate({ to: sessionPlace({ sessionId: reusable.id }) });
      return reusable;
    }
    const { session } = await state.createSession({ workspaceId, goal: '', omitGoalSlot: true });
    set({ blankSessionId: session.id });
    return session;
  };
};
