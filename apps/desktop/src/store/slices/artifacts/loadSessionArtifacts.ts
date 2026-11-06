import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { refreshSessionArtifacts } from './refresh';
import type { GetFn, SetFn } from './types';

type CommentsParams = Readonly<{
  get: GetFn;
  sessionId: SessionId;
}>;

const loadComments = async ({ get, sessionId }: CommentsParams): Promise<void> => {
  try {
    await get().loadArtifactComments({ sessionId });
  } catch (error) {
    void get().reportError({
      title: "Couldn't load the plan comments",
      error,
      sessionId,
      coalesceKey: `artifact-comments-load:${sessionId}`,
    });
  }
};

export const loadSessionArtifacts = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    set((state) => ({ artifactLoadErrors: { ...state.artifactLoadErrors, [sessionId]: null } }));
    try {
      await refreshSessionArtifacts(set, sessionId);
      await loadComments({ get, sessionId });
    } catch (error) {
      set((state) => ({
        artifactLoadErrors: { ...state.artifactLoadErrors, [sessionId]: formatError(error) },
      }));
    }
  };
};
