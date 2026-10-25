import type { SessionId } from '@goodboy/types';
import { listArtifactsForSession } from '../../../features/artifacts/artifacts';
import { listPlansForSession } from '../../../features/plans/plans';
import { sessionReads } from '../../runtime/state-writes/sessionReads';
import type { SetFn } from './types';

export const refreshSessionArtifacts = async (set: SetFn, sessionId: SessionId): Promise<void> => {
  const artifactsRead = sessionReads.artifacts({ sessionId });
  const artifacts = await listArtifactsForSession(sessionId);
  set((state) =>
    artifactsRead.isCurrent()
      ? { sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: artifacts } }
      : {},
  );
};

export const refreshSessionArtifactsAndPlans = async (
  set: SetFn,
  sessionId: SessionId,
): Promise<void> => {
  const artifactsRead = sessionReads.artifacts({ sessionId });
  const plansRead = sessionReads.plans({ sessionId });
  const [artifacts, plans] = await Promise.all([
    listArtifactsForSession(sessionId),
    listPlansForSession(sessionId),
  ]);
  set((state) => ({
    ...(artifactsRead.isCurrent() && {
      sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: artifacts },
    }),
    ...(plansRead.isCurrent() && { sessionPlans: { ...state.sessionPlans, [sessionId]: plans } }),
  }));
};
