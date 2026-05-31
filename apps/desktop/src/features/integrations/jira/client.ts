import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';

export type JiraSelf = {
  accountId: string;
  displayName: string;
  emailAddress: string;
};

export type JiraIssueStatus = {
  name: string;
  statusCategoryKey: string;
};

export type JiraIssue = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  url: string;
  status: JiraIssueStatus;
  updatedAt: string;
};

export async function jiraConnect(
  workspaceId: WorkspaceId,
  siteUrl: string,
  email: string,
  token: string,
): Promise<JiraSelf> {
  return invoke<JiraSelf>('jira_connect', { workspaceId, siteUrl, email, token });
}

export async function jiraDisconnect(workspaceId: WorkspaceId): Promise<void> {
  await invoke('jira_disconnect', { workspaceId });
}

export async function jiraFetchAssignedIssues(
  workspaceId: WorkspaceId,
  siteUrl: string,
  email: string,
): Promise<JiraIssue[]> {
  return invoke<JiraIssue[]>('jira_fetch_assigned_issues', { workspaceId, siteUrl, email });
}
