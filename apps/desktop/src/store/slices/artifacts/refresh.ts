import type { SessionId } from '@goodboy/types';
import { listArtifactsForSession } from '../../../features/artifacts/artifacts';
import type { SetFn } from './types';

export const refreshSessionArtifacts = async (set: SetFn, sessionId: SessionId): Promise<void> => {
  const artifacts = await listArtifactsForSession(sessionId);
  set((state) => ({
    sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: artifacts },
  }));
};
