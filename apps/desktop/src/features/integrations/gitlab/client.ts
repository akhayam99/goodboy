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

export const issueIdentifier = (issue: GitlabIssue): string =>
  issue.references.full ?? `#${issue.iid}`;

export type GitlabMergeRequest = {
  id: number;
  iid: number;
  projectId: number;
  title: string;
  description: string | null;
  state: string;
  webUrl: string;
  sourceBranch: string;
  targetBranch: string;
  draft: boolean;
  hasConflicts: boolean;
  mergeStatus: string | null;
};

export const gitlabMrForBranch = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  sourceBranch: string,
): Promise<GitlabMergeRequest | null> => {
  return invoke<GitlabMergeRequest | null>('gitlab_mr_for_branch', {
    workspaceId,
    host,
    projectPath,
    sourceBranch,
  });
};

export const gitlabCreateMr = async (args: {
  workspaceId: WorkspaceId;
  host: string;
  projectPath: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  draft: boolean;
}): Promise<GitlabMergeRequest> => {
  return invoke<GitlabMergeRequest>('gitlab_create_mr', args);
};

export const gitlabMergeMr = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  mrIid: number,
): Promise<GitlabMergeRequest> => {
  return invoke<GitlabMergeRequest>('gitlab_merge_mr', {
    workspaceId,
    host,
    projectPath,
    mrIid,
  });
};
