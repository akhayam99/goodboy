import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';

export type GitlabUser = {
  id: number;
  username: string;
  name: string;
};

export type GitlabIssue = {
  id: number;
  iid: number;
  projectId: number;
  title: string;
  description: string | null;
  state: string;
  webUrl: string;
  references: { full: string };
  updatedAt: string;
  milestone: { title: string } | null;
  labels: ReadonlyArray<string>;
};

export const gitlabConnect = async (
  workspaceId: WorkspaceId,
  host: string,
  token: string,
): Promise<GitlabUser> => {
  return invoke<GitlabUser>('gitlab_connect', { workspaceId, host, token });
};

export const gitlabDisconnect = async (workspaceId: WorkspaceId): Promise<void> => {
  await invoke('gitlab_disconnect', { workspaceId });
};

export const gitlabFetchAssignedIssues = async (
  workspaceId: WorkspaceId,
  host: string,
): Promise<GitlabIssue[]> => {
  return invoke<GitlabIssue[]>('gitlab_fetch_assigned_issues', { workspaceId, host });
};

export const issueIdentifier = (issue: GitlabIssue): string => {
  return issue.references.full ?? `#${issue.iid}`;
};
