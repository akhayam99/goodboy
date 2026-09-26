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

type SentryIssueProject = {
  slug: string;
  name: string | null;
};

export type SentryIssue = {
  id: string;
  project?: SentryIssueProject | null;
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

export type SentryOrganizationSummary = {
  readonly slug: string;
  readonly name: string;
};

export type SentryProjectSummary = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly platform: string | null;
};

type SentryListParams = {
  readonly credentialId: IntegrationCredentialId;
  readonly token: string | null;
};

export const sentryListOrganizations = async ({
  credentialId,
  token,
}: SentryListParams): Promise<ReadonlyArray<SentryOrganizationSummary>> =>
  invoke<ReadonlyArray<SentryOrganizationSummary>>('sentry_list_organizations', {
    credentialId,
    token,
  });

export const sentryListProjects = async ({
  credentialId,
  token,
  org,
}: SentryListParams & { readonly org: string }): Promise<ReadonlyArray<SentryProjectSummary>> =>
  invoke<ReadonlyArray<SentryProjectSummary>>('sentry_list_projects', {
    credentialId,
    token,
    org,
  });

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
  sentryProject?: string,
): Promise<SentryIssuesPage> => {
  return invoke<SentryIssuesPage>('sentry_fetch_issues', {
    workspaceId,
    query: query ?? null,
    cursor: cursor ?? null,
    sentryProject: sentryProject ?? null,
    ...(projectId != null ? { projectId } : {}),
  });
};

export type SentryCodeMapping = {
  readonly projectSlug: string | null;
  readonly repoName: string | null;
  readonly stackRoot: string | null;
  readonly sourceRoot: string | null;
};

export const sentryListCodeMappings = async ({
  workspaceId,
}: {
  readonly workspaceId: WorkspaceId;
}): Promise<ReadonlyArray<SentryCodeMapping>> =>
  invoke<ReadonlyArray<SentryCodeMapping>>('sentry_list_code_mappings', { workspaceId });

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
