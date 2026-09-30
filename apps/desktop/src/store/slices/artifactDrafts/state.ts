import type { SessionId } from '@goodboy/types';
import type { SessionArtifactDrafts } from './types';

export type ArtifactDraftsState = {
  readonly artifactDrafts: Readonly<Record<SessionId, SessionArtifactDrafts>>;
};

export const artifactDraftsInitialState: ArtifactDraftsState = {
  artifactDrafts: {},
};
