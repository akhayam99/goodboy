import type { ProjectId, ProjectSentryLinkSource, WorkspaceId } from '@goodboy/types';
import type { SentryLinksState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type LoadProjectSentryLinksParams = {
  readonly workspaceId: WorkspaceId;
};

export type LinkSentryProjectParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly sentryOrg: string;
  readonly sentryProject: string;
  readonly sentryProjectName: string | null;
  readonly source: ProjectSentryLinkSource;
};

export type UnlinkSentryProjectParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly sentryOrg: string;
  readonly sentryProject: string;
};

export type SentryLinksSlice = SentryLinksState & {
  loadProjectSentryLinks(params: LoadProjectSentryLinksParams): Promise<void>;
  linkSentryProject(params: LinkSentryProjectParams): Promise<void>;
  unlinkSentryProject(params: UnlinkSentryProjectParams): Promise<void>;
};
