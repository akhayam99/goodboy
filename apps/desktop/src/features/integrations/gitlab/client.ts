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

export const gitlabFetchIssue = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  issueIid: number,
): Promise<GitlabIssue> => {
  return invoke<GitlabIssue>('gitlab_fetch_issue', {
    workspaceId,
    host,
    projectPath,
    issueIid,
  });
};

type UpdateDescriptionParams = {
  readonly workspaceId: WorkspaceId;
  readonly host: string;
  readonly projectPath: string;
  readonly issueIid: number;
  readonly description: string;
};

export const gitlabUpdateIssueDescription = async ({
  workspaceId,
  host,
  projectPath,
  issueIid,
  description,
}: UpdateDescriptionParams): Promise<string> => {
  return invoke<string>('gitlab_update_issue', {
    workspaceId,
    host,
    projectPath,
    issueIid,
    description,
  });
};

export const issueIdentifier = (issue: GitlabIssue): string =>
  issue.references.full ?? `#${issue.iid}`;

export type GitlabMergeStatus =
  | 'unchecked'
  | 'checking'
  | 'can_be_merged'
  | 'cannot_be_merged'
  | 'cannot_be_merged_recheck'
  | null;

export type GitlabMrAuthor = {
  username: string;
  name: string;
  avatarUrl: string | null;
};

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
  mergeStatus: GitlabMergeStatus;
  updatedAt: string;
  author?: GitlabMrAuthor | null;
  reviewers?: ReadonlyArray<GitlabMrAuthor> | null;
};

export const gitlabFetchAssignedMrs = async (
  workspaceId: WorkspaceId,
  host: string,
): Promise<GitlabMergeRequest[]> => {
  return invoke<GitlabMergeRequest[]>('gitlab_fetch_assigned_mrs', { workspaceId, host });
};

export const gitlabFetchProjectMrs = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
): Promise<GitlabMergeRequest[]> => {
  return invoke<GitlabMergeRequest[]>('gitlab_fetch_project_mrs', {
    workspaceId,
    host,
    projectPath,
  });
};

export type GitlabMergeStatusTone = 'success' | 'danger' | 'muted';

export const humanizeMergeStatus = (
  status: GitlabMergeStatus,
): { label: string; tone: GitlabMergeStatusTone } | null => {
  switch (status) {
    case 'can_be_merged':
      return { label: 'Can merge', tone: 'success' };
    case 'cannot_be_merged':
      return { label: 'Blocked', tone: 'danger' };
    case 'checking':
    case 'unchecked':
    case 'cannot_be_merged_recheck':
      return { label: 'Checking', tone: 'muted' };
    default:
      return null;
  }
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

export const gitlabMrDiff = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  mrIid: number,
): Promise<string> => {
  return invoke<string>('gitlab_mr_diff', {
    workspaceId,
    host,
    projectPath,
    mrIid,
  });
};

export type GitlabDiffRefs = {
  baseSha: string;
  headSha: string;
  startSha: string;
};

export const gitlabMrDiffRefs = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  mrIid: number,
): Promise<GitlabDiffRefs> => {
  return invoke<GitlabDiffRefs>('gitlab_mr_diff_refs', {
    workspaceId,
    host,
    projectPath,
    mrIid,
  });
};

export type GitlabDiscussionPosition = {
  baseSha: string;
  headSha: string;
  startSha: string;
  newPath: string;
  newLine?: number;
  oldPath?: string;
  oldLine?: number;
};

export const gitlabCreateMrDiscussion = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  mrIid: number,
  body: string,
  position: GitlabDiscussionPosition,
): Promise<string> => {
  return invoke<string>('gitlab_create_mr_discussion', {
    workspaceId,
    host,
    projectPath,
    mrIid,
    body,
    position,
  });
};

export const gitlabCreateMrNote = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  mrIid: number,
  body: string,
): Promise<number> => {
  return invoke<number>('gitlab_create_mr_note', {
    workspaceId,
    host,
    projectPath,
    mrIid,
    body,
  });
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
