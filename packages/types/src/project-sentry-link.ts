import type { IsoDateTime, ProjectId, WorkspaceId } from './ids';

export type ProjectSentryLinkSource = 'manual' | 'code_mapping';

export type ProjectSentryLink = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
  projectId: ProjectId;
  sentryOrg: string;
  sentryProject: string;
  sentryProjectName: string | null;
  source: ProjectSentryLinkSource;
  createdAt: IsoDateTime;
}>;
