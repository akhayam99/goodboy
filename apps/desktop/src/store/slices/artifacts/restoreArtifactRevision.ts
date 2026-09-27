import type { SessionArtifact, SessionId } from '@goodboy/types';
import { loadArtifactRevision, updateArtifactSource } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifacts } from './refresh';
import type { SetFn } from './types';

export type RestoreArtifactRevisionParams = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly revision: number;
};

export const restoreArtifactRevision = (set: SetFn) => {
  return async ({ sessionId, artifact, revision }: RestoreArtifactRevisionParams) => {
    const target = await loadArtifactRevision({ artifactId: artifact.id, revision });
    if (target === null) {
      throw new Error(`v${revision} is not in the history of this artifact`);
    }
    await updateArtifactSource({
      artifactId: artifact.id,
      title: target.title,
      sourceFormat: artifact.sourceFormat,
      sourceText: target.sourceText,
      metadata: artifact.metadata,
      note: { author: 'restore', ask: `Restored v${revision}` },
    });
    await refreshSessionArtifacts(set, sessionId);
  };
};
