import type { SessionArtifact, SessionId } from '@goodboy/types';
import { restoreArtifactToRevision } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifacts } from './refresh';
import type { SetFn } from './types';

export type RestoreArtifactRevisionParams = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly revision: number;
};

const RESTORE_CONFLICT_MESSAGE = 'A newer version arrived. Review it before restoring.';

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
      throw new Error(RESTORE_CONFLICT_MESSAGE);
    }
    if (outcome.kind === 'missing_revision') {
      throw new Error(`v${revision} is not in the history of this artifact`);
    }
    throw new Error('This artifact is no longer there.');
  };
};
