import type { ArtifactId, ArtifactStatus, SessionId } from '@goodboy/types';
import { setArtifactStatus as invokeSetArtifactStatus } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifactsAndPlans } from './refresh';
import type { GetFn, SetFn } from './types';

export type RestoreArtifactParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly status?: ArtifactStatus;
};

export const restoreArtifact = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, artifactId, status }: RestoreArtifactParams): Promise<void> => {
    const plan = (get().sessionPlans[sessionId] ?? []).find(
      (candidate) => candidate.id === artifactId,
    );
    const hasRun = plan !== undefined && plan.consumptionCount > 0;
    await invokeSetArtifactStatus(artifactId, status ?? (hasRun ? 'consumed' : 'active'));
    await refreshSessionArtifactsAndPlans(set, sessionId);
  };
};
