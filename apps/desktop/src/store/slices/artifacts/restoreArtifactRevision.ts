import type { SessionArtifact, SessionId } from '@goodboy/types';
import { restoreArtifactToRevision } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifacts } from './refresh';
import { RestoreConflictError } from './RestoreConflictError';
import type { SetFn } from './types';

export type RestoreArtifactRevisionParams = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly revision: number;
};

export const restoreArtifactRevision = (set: SetFn) => {
  return async ({ sessionId, artifact, revision }: RestoreArtifactRevisionParams) => {
    const outcome = await restoreArtifactToRevision({
      artifactId: artifact.id,
      expectedRevision: artifact.revision,
      revision,
    });
    if (outcome.kind === 'restored') {
      await refreshSessionArtifacts(set, sessionId);
      return;
    }
    if (outcome.kind === 'conflict') {
      await refreshSessionArtifacts(set, sessionId);
      throw new RestoreConflictError();
    }
    if (outcome.kind === 'missing_revision') {
      throw new Error(`v${revision} is not in the history of this artifact`);
    }
    throw new Error('This artifact is no longer there.');
  };
};
