import type { AgentId, IsoDateTime, SessionId } from './ids';

export type DiffCommentStatus = 'open' | 'resolved' | 'consumed';

export type DiffCommentAuthorKind = 'user' | 'agent';

export type DiffCommentSide = 'old' | 'new';

export type DiffCommentAnchor = Readonly<{
  side: DiffCommentSide;
  lineNumber: number;
  endLineNumber?: number;
}>;

export type DiffComment = Readonly<{
  id: string;
  sessionId: SessionId;
  filePath: string;
  body: string;
  status: DiffCommentStatus;
  createdAt: IsoDateTime;
  resolvedAt?: IsoDateTime;
  consumedAt?: IsoDateTime;
  consumedByAgentId?: AgentId;
  anchor?: DiffCommentAnchor;
  authorKind: DiffCommentAuthorKind;
  authorAgentId?: AgentId;
}>;
