import type { ArtifactComment, ArtifactId, SessionId } from '@goodboy/types';

export type ArtifactCommentsState = {
  readonly artifactComments: Readonly<Record<SessionId, ReadonlyArray<ArtifactComment>>>;
  readonly artifactCommentSends: Readonly<Record<ArtifactId, true>>;
};

export const artifactCommentsInitialState: ArtifactCommentsState = {
  artifactComments: {},
  artifactCommentSends: {},
};
