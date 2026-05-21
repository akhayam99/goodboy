import type { IdeaBacklogId, IsoDateTime, WorkspaceId } from './ids';

export type IdeaBacklogStatus = 'raw' | 'rephrased' | 'spawned' | 'failed';

export interface IdeaBacklog {
  readonly id: IdeaBacklogId;
  readonly rawText: string;
  readonly rephrasedTitle: string | null;
  readonly rephrasedBody: string | null;
  readonly suggestedWorkspaceId: WorkspaceId | null;
  readonly workspaceId: WorkspaceId;
  readonly status: IdeaBacklogStatus;
  readonly retryCount: number;
  readonly lastError: string | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}
