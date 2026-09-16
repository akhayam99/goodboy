import type { ArtifactId, ArtifactSourceFormat, SessionArtifact, SessionId } from '@goodboy/types';
import { updateArtifactSource as invokeUpdateArtifactSource } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifacts } from './refresh';
import type { SetFn } from './types';

export type UpdateArtifactSourceParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
  readonly title: string;
  readonly sourceFormat: ArtifactSourceFormat;
  readonly sourceText: string;
  readonly metadata: SessionArtifact['metadata'];
};

export const updateArtifactSource = (set: SetFn) => {
  return async (params: UpdateArtifactSourceParams) => {
    await invokeUpdateArtifactSource({
      artifactId: params.artifactId,
      title: params.title,
      sourceFormat: params.sourceFormat,
      sourceText: params.sourceText,
      metadata: params.metadata,
    });
    await refreshSessionArtifacts(set, params.sessionId);
  };
};
