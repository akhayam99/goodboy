import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';

export type SentryOrganization = {
  slug: string;
  name: string;
};

export type SentryProject = {
  slug: string;
  name: string;
  organization: SentryOrganization;
};

export type SentryIssueMetadata = {
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

export type SentryIssueDetail = {
  title: string | null;
  culprit: string | null;
  frames: SentryStackFrame[];
};

export const sentryConnect = async (
  workspaceId: WorkspaceId,
  token: string,
  org: string,
  project: string,
): Promise<SentryProject> => {
  return invoke<SentryProject>('sentry_connect', { workspaceId, token, org, project });
};

export const sentryDisconnect = async (workspaceId: WorkspaceId): Promise<void> => {
  await invoke('sentry_disconnect', { workspaceId });
};

export const sentryFetchIssues = async (
  workspaceId: WorkspaceId,
  query?: string,
  cursor?: string,
): Promise<SentryIssuesPage> => {
  return invoke<SentryIssuesPage>('sentry_fetch_issues', {
    workspaceId,
    query: query ?? null,
    cursor: cursor ?? null,
  });
};

export const sentryFetchIssueDetail = async (
  workspaceId: WorkspaceId,
  issueId: string,
): Promise<SentryIssueDetail> => {
  return invoke<SentryIssueDetail>('sentry_fetch_issue_detail', { workspaceId, issueId });
};
