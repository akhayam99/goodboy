import type { SessionId } from '@goodboy/types';
import { listArtifactsForSession } from '../../../features/artifacts/artifacts';
import { listPlansForSession } from '../../../features/plans/plans';
import type { SetFn } from './types';

export const refreshSessionArtifacts = async (set: SetFn, sessionId: SessionId): Promise<void> => {
  const artifacts = await listArtifactsForSession(sessionId);
  set((state) => ({
    sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: artifacts },
  }));
};

export const refreshSessionArtifactsAndPlans = async (
  set: SetFn,
  sessionId: SessionId,
): Promise<void> => {
  const [artifacts, plans] = await Promise.all([
    listArtifactsForSession(sessionId),
    listPlansForSession(sessionId),
  ]);
  set((state) => ({
    sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: artifacts },
    sessionPlans: { ...state.sessionPlans, [sessionId]: plans },
  }));
};
