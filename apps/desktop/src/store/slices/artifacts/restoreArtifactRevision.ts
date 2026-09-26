import type { SessionArtifact, SessionId } from '@goodboy/types';
import { listArtifactRevisions, updateArtifactSource } from '../../../features/artifacts/artifacts';
import { refreshSessionArtifacts } from './refresh';
import type { SetFn } from './types';

export type RestoreArtifactRevisionParams = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly revision: number;
};

export const restoreArtifactRevision = (set: SetFn) => {
  return async ({ sessionId, artifact, revision }: RestoreArtifactRevisionParams) => {
    const revisions = await listArtifactRevisions(artifact.id);
    const target = revisions.find((entry) => entry.revision === revision) ?? null;
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
