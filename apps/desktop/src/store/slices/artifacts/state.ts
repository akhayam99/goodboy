import type { AgentId, ArtifactId, SessionArtifact, SessionId } from '@goodboy/types';
import type { WireframeDraft } from '../../../features/wireframes/wireframeDraft';
import type { WireframeScoutVerification } from '../../../features/wireframes/wireframeScoutProgress';

export type ArtifactsState = {
  readonly artifactLoadErrors: Readonly<Record<SessionId, string | null>>;
  readonly sessionArtifacts: Readonly<Record<SessionId, ReadonlyArray<SessionArtifact>>>;
  readonly wireframeScoutVerification: Readonly<Record<AgentId, WireframeScoutVerification>>;
  readonly wireframeDrafts: Readonly<Record<ArtifactId, WireframeDraft>>;
};

export const artifactsInitialState: ArtifactsState = {
  artifactLoadErrors: {},
  sessionArtifacts: {},
  wireframeScoutVerification: {},
  wireframeDrafts: {},
};
