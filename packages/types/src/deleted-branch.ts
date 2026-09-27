import type { IsoDateTime, ProjectId, SessionId, WorkspaceId } from './ids';

export const DELETED_BRANCH_KEEP_DAYS = 14;

export type DeletedBranch = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
  projectId: ProjectId;
  sessionId: SessionId | null;
  repoRoot: string;
  branch: string;
  sha: string;
  keepRef: string;
  onOrigin: boolean;
  deletedAt: IsoDateTime;
  restoredAt: IsoDateTime | null;
}>;
