import type { IsoDateTime, TaskId } from './ids';

export type DiffCommentStatus = 'open' | 'resolved';

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
  anchor?: DiffCommentAnchor;
}>;
