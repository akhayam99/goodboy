import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { refreshSessionArtifacts } from './refresh';
import type { SetFn } from './types';

export const loadSessionArtifacts = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    set((state) => ({ artifactLoadErrors: { ...state.artifactLoadErrors, [sessionId]: null } }));
    try {
      await refreshSessionArtifacts(set, sessionId);
    } catch (error) {
      set((state) => ({
        artifactLoadErrors: { ...state.artifactLoadErrors, [sessionId]: formatError(error) },
      }));
    }
  };
};
