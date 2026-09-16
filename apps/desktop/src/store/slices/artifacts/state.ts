import type { AgentId, SessionArtifact, SessionId } from '@goodboy/types';
import type { WireframeScoutVerification } from '../../../features/wireframes/wireframeScoutProgress';

export type ArtifactsState = {
  readonly sessionArtifacts: Readonly<Record<SessionId, ReadonlyArray<SessionArtifact>>>;
  readonly wireframeScoutVerification: Readonly<Record<AgentId, WireframeScoutVerification>>;
};

export const artifactsInitialState: ArtifactsState = {
  sessionArtifacts: {},
  wireframeScoutVerification: {},
};
