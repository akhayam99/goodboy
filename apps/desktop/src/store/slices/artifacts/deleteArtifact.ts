import type { ArtifactId, ArtifactStatus, SessionId } from '@goodboy/types';
import { setArtifactStatus as invokeSetArtifactStatus } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifactsAndPlans } from './refresh';
import type { GetFn, SetFn } from './types';

export type DeleteArtifactParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const deleteArtifact = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    artifactId,
  }: DeleteArtifactParams): Promise<ArtifactStatus | null> => {
    const state = get();
    const plan = (state.sessionPlans[sessionId] ?? []).find(
      (candidate) => candidate.id === artifactId,
    );
    const stored = (state.sessionArtifacts[sessionId] ?? []).find(
      (candidate) => candidate.id === artifactId,
    );
    const previous = plan?.status ?? stored?.status ?? null;
    if (previous === null || previous === 'discarded') {
      return null;
    }
    await invokeSetArtifactStatus(artifactId, 'discarded');
    await refreshSessionArtifactsAndPlans(set, sessionId);
    return previous;
  };
};
