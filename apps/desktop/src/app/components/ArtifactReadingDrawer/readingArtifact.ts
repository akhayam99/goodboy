import type { ArtifactId, ReportArtifact, SessionId, WireframeArtifact } from '@goodboy/types';
import type { AppState } from '../../../store/types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const readingArtifactOf = ({
  state,
  sessionId,
  artifactId,
}: Params): ReportArtifact | WireframeArtifact | null => {
  const artifact =
    (state.sessionArtifacts[sessionId] ?? []).find((candidate) => candidate.id === artifactId) ??
    null;
  if (artifact === null || (artifact.kind !== 'report' && artifact.kind !== 'wireframe')) {
    return null;
  }
  return artifact;
};
