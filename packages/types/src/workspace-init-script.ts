import type { IsoDateTime, WorkspaceId } from './ids';

export interface WorkspaceInitScript {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly content: string;
  readonly createdAt: IsoDateTime;
}
