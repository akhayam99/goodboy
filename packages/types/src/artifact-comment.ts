import type { ArtifactId } from './artifact';
import type { IsoDateTime, SessionId } from './ids';

export type ArtifactCommentStatus = 'draft' | 'sent' | 'addressed' | 'open';

export type ArtifactCommentAnchor =
  | Readonly<{ kind: 'part'; index: number; title: string }>
  | Readonly<{ kind: 'block'; order: number; text: string }>
  | Readonly<{ kind: 'quote'; order: number; text: string; blockText: string }>;

export type ArtifactComment = Readonly<{
  id: string;
  sessionId: SessionId;
  artifactId: ArtifactId;
  revision: number;
  anchor: ArtifactCommentAnchor;
  body: string;
  status: ArtifactCommentStatus;
  sentTurnId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;
