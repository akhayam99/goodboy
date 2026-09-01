import { invoke } from '@tauri-apps/api/core';
import type { IntegrationCredentialId, ProjectId, WorkspaceId } from '@goodboy/types';

type SentryOrganization = {
  slug: string;
  name: string;
};

export type SentryProject = {
  slug: string;
  name: string;
  organization: SentryOrganization;
};

type SentryIssueMetadata = {
  type: string | null;
  value: string | null;
};

export type SentryIssue = {
  id: string;
  shortId: string | null;
  title: string;
  culprit: string | null;
  level: string | null;
  status: string | null;
  count: string | null;
  userCount: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  permalink: string | null;
  metadata: SentryIssueMetadata | null;
};

export type SentryIssuesPage = {
  issues: SentryIssue[];
  next_cursor: string | null;
};

export type SentryStackFrame = {
  filename: string | null;
  function: string | null;
  line_no: number | null;
  in_app: boolean;
};

export type SentryTag = {
  key: string;
  value: string;
};

export type SentryBreadcrumb = {
  category: string | null;
  message: string | null;
  level: string | null;
  timestamp: string | null;
};

export type SentryIssueDetail = {
  title: string | null;
  culprit: string | null;
  frames: SentryStackFrame[];
  tags?: SentryTag[];
  breadcrumbs?: SentryBreadcrumb[];
};

export const sentryValidateConnection = async (
  credentialId: IntegrationCredentialId,
  token: string | null,
  org: string,
  project: string,
): Promise<SentryProject> => {
  return invoke<SentryProject>('sentry_validate_connection', {
    credentialId,
    token,
    org,
    project,
  });
};

export const sentryConnect = async (
  credentialId: IntegrationCredentialId,
  token: string | null,
): Promise<void> => {
  await invoke('sentry_connect', { credentialId, token });
};

export const sentryFetchIssues = async (
  workspaceId: WorkspaceId,
  query?: string,
  cursor?: string,
  projectId?: ProjectId,
): Promise<SentryIssuesPage> => {
  return invoke<SentryIssuesPage>('sentry_fetch_issues', {
    workspaceId,
    query: query ?? null,
    cursor: cursor ?? null,
    ...(projectId != null ? { projectId } : {}),
  });
};

type FetchIssueParams = {
  readonly workspaceId: WorkspaceId;
  readonly issueId: string;
  readonly projectId?: ProjectId;
};

export const sentryFetchIssue = async ({
  workspaceId,
  issueId,
  projectId,
}: FetchIssueParams): Promise<SentryIssue> => {
  return invoke<SentryIssue>('sentry_fetch_issue', {
    workspaceId,
    issueId,
    ...(projectId != null ? { projectId } : {}),
  });
};

export const sentryFetchIssueDetail = async (
  workspaceId: WorkspaceId,
  issueId: string,
  projectId?: ProjectId,
): Promise<SentryIssueDetail> => {
  return invoke<SentryIssueDetail>('sentry_fetch_issue_detail', {
    workspaceId,
    issueId,
    ...(projectId != null ? { projectId } : {}),
  });
};
