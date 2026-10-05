import type {
  ArtifactComment,
  ArtifactCommentAnchor,
  ArtifactId,
  PlanWithCount,
  SessionId,
} from '@goodboy/types';

export type { GetFn, SetFn } from '../../slice-types';

export type AddArtifactCommentParams = Readonly<{
  sessionId: SessionId;
  artifactId: ArtifactId;
  revision: number;
  anchor: ArtifactCommentAnchor;
  body: string;
}>;

export type EditArtifactCommentParams = Readonly<{
  sessionId: SessionId;
  commentId: string;
  body: string;
}>;

export type RemoveArtifactCommentParams = Readonly<{
  sessionId: SessionId;
  commentId: string;
}>;

export type SendArtifactCommentsParams = Readonly<{
  sessionId: SessionId;
  plan: PlanWithCount;
}>;

export type SendArtifactCommentsResult =
  | Readonly<{ kind: 'revised'; revision: number; addressed: number; open: number }>
  | Readonly<{ kind: 'unchanged' }>
  | Readonly<{ kind: 'empty' }>
  | Readonly<{ kind: 'busy' }>
  | Readonly<{ kind: 'blocked'; reason: string }>
  | Readonly<{ kind: 'failed'; reason: string }>;
