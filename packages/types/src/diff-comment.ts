import type { IsoDateTime, SessionId, TaskId } from './ids';

export type DiffCommentStatus = 'open' | 'resolved' | 'consumed';

export type DiffCommentSide = 'old' | 'new';

export type DiffCommentAnchor = Readonly<{
  side: DiffCommentSide;
  lineNumber: number;
}>;

export type DiffComment = Readonly<{
  id: string;
  taskId: TaskId;
  filePath: string;
  body: string;
  status: DiffCommentStatus;
  createdAt: IsoDateTime;
  resolvedAt?: IsoDateTime;
  consumedAt?: IsoDateTime;
  consumedByAgentId?: SessionId;
  anchor?: DiffCommentAnchor;
}>;
