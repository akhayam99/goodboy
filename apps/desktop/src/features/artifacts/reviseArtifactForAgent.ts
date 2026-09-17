import type {
  AgentId,
  ArtifactKind,
  ArtifactSourceFormat,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { listArtifactsForSession, updateArtifactSource } from './artifacts';
import { loadArtifactProvenance } from './artifactProvenance';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
  kind: ArtifactKind;
  title: string;
  sourceFormat: ArtifactSourceFormat;
  sourceText: string;
  metadata: SessionArtifact['metadata'];
  sourceTurnId: string;
}>;

export const reviseArtifactForAgent = async ({
  sessionId,
  agentId,
  kind,
  title,
  sourceFormat,
  sourceText,
  metadata,
  sourceTurnId,
}: Params): Promise<SessionArtifact | null> => {
  const artifacts = await listArtifactsForSession(sessionId);
  const prior =
    [...artifacts]
      .reverse()
      .find(
        (candidate) =>
          candidate.agentId === agentId &&
          candidate.kind === kind &&
          candidate.status !== 'discarded',
      ) ?? null;
  if (prior === null || prior.sourceTurnId === sourceTurnId) {
    return null;
  }
  if (prior.title === title && prior.sourceText === sourceText) {
    return prior;
  }
  const provenance = await loadArtifactProvenance(agentId).catch(() => null);
  if (provenance === null) {
    return null;
  }
  return updateArtifactSource({
    artifactId: prior.id,
    title,
    sourceFormat,
    sourceText,
    metadata,
  });
};
