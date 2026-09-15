import type { SessionArtifact, SessionId } from '@goodboy/types';

export type ArtifactsState = {
  readonly sessionArtifacts: Readonly<Record<SessionId, ReadonlyArray<SessionArtifact>>>;
};

export const artifactsInitialState: ArtifactsState = {
  sessionArtifacts: {},
};
