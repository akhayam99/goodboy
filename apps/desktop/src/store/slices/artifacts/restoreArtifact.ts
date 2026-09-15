import type { ArtifactId, SessionId } from '@goodboy/types';
import { restoreArtifact as invokeRestoreArtifact } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifacts } from './refresh';
import type { SetFn } from './types';

export type RestoreArtifactParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const restoreArtifact = (set: SetFn) => {
  return async (params: RestoreArtifactParams) => {
    await invokeRestoreArtifact(params.artifactId);
    await refreshSessionArtifacts(set, params.sessionId);
  };
};
