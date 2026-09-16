import type { ArtifactId, SessionId } from '@goodboy/types';
import { discardArtifact as invokeDiscardArtifact } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifacts } from './refresh';
import type { SetFn } from './types';

export type DeleteArtifactParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const deleteArtifact = (set: SetFn) => {
  return async (params: DeleteArtifactParams) => {
    await invokeDiscardArtifact(params.artifactId);
    await refreshSessionArtifacts(set, params.sessionId);
  };
};
