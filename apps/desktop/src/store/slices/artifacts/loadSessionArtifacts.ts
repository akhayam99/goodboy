import type { SessionId } from '@goodboy/types';
import { refreshSessionArtifacts } from './refresh';
import type { SetFn } from './types';

export const loadSessionArtifacts = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    await refreshSessionArtifacts(set, sessionId);
  };
};
