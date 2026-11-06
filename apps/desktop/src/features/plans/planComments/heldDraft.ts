import type { ArtifactCommentAnchor, ArtifactId, SessionId } from '@goodboy/types';

export type HeldDraft = Readonly<{
  sessionId: SessionId;
  artifactId: ArtifactId;
  revision: number;
  anchor: ArtifactCommentAnchor;
  body: string;
}>;
