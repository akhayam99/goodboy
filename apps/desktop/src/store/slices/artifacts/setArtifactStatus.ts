import type { ArtifactId, ArtifactStatus, SessionId } from '@goodboy/types';
import { setArtifactStatus as invokeSetArtifactStatus } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifacts } from './refresh';
import type { SetFn } from './types';

export type SetArtifactStatusParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly status: ArtifactStatus;
};

export const setArtifactStatus = (set: SetFn) => {
  return async (params: SetArtifactStatusParams) => {
    await invokeSetArtifactStatus(params.artifactId, params.status);
    await refreshSessionArtifacts(set, params.sessionId);
  };
};
