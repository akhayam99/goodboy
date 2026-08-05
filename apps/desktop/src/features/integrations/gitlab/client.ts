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

export type GitlabNotePosition = {
  newPath: string | null;
  oldPath: string | null;
  newLine: number | null;
  oldLine: number | null;
};

export type GitlabMrNote = {
  id: number;
  body: string;
  system: boolean;
  author: GitlabMrAuthor | null;
  createdAt: string;
  resolvable: boolean;
  resolved: boolean | null;
  position: GitlabNotePosition | null;
};

export type GitlabMrDiscussion = {
  id: string;
  individualNote: boolean;
  notes: ReadonlyArray<GitlabMrNote>;
};

export type GitlabMrApproval = {
  user: GitlabMrAuthor;
};

export type GitlabMrApprovalState = {
  approvalsRequired: number;
  approvalsLeft: number;
  userHasApproved: boolean;
  userCanApprove: boolean;
  approvedBy: ReadonlyArray<GitlabMrApproval>;
};

type MrTarget = {
  readonly workspaceId: WorkspaceId;
  readonly host: string;
  readonly projectPath: string;
  readonly mrIid: number;
};

export const gitlabListMrDiscussions = async ({
  workspaceId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<ReadonlyArray<GitlabMrDiscussion>> => {
  return invoke<ReadonlyArray<GitlabMrDiscussion>>('gitlab_list_mr_discussions', {
    workspaceId,
    host,
    projectPath,
    mrIid,
  });
};

type ReplyParams = MrTarget & {
  readonly discussionId: string;
  readonly body: string;
};

export const gitlabReplyToMrDiscussion = async ({
  workspaceId,
  host,
  projectPath,
  mrIid,
  discussionId,
  body,
}: ReplyParams): Promise<number> => {
  return invoke<number>('gitlab_reply_to_mr_discussion', {
    workspaceId,
    host,
    projectPath,
    mrIid,
    discussionId,
    body,
  });
};

export type GitlabIssueNote = {
  id: number;
  body: string;
  system: boolean;
  author: GitlabMrAuthor | null;
  createdAt: string;
};

type IssueTarget = {
  readonly workspaceId: WorkspaceId;
  readonly host: string;
  readonly projectPath: string;
  readonly issueIid: number;
};

export const gitlabListIssueNotes = async ({
  workspaceId,
  host,
  projectPath,
  issueIid,
}: IssueTarget): Promise<ReadonlyArray<GitlabIssueNote>> => {
  return invoke<ReadonlyArray<GitlabIssueNote>>('gitlab_list_issue_notes', {
    workspaceId,
    host,
    projectPath,
    issueIid,
  });
};

type CreateIssueNoteParams = IssueTarget & {
  readonly body: string;
};

export const gitlabCreateIssueNote = async ({
  workspaceId,
  host,
  projectPath,
  issueIid,
  body,
}: CreateIssueNoteParams): Promise<number> => {
  return invoke<number>('gitlab_create_issue_note', {
    workspaceId,
    host,
    projectPath,
    issueIid,
    body,
  });
};

export const gitlabMrApprovalState = async ({
  workspaceId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<GitlabMrApprovalState | null> => {
  return invoke<GitlabMrApprovalState | null>('gitlab_mr_approval_state', {
    workspaceId,
    host,
    projectPath,
    mrIid,
  });
};

export const gitlabApproveMr = async ({
  workspaceId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<GitlabMrApprovalState | null> => {
  return invoke<GitlabMrApprovalState | null>('gitlab_approve_mr', {
    workspaceId,
    host,
    projectPath,
    mrIid,
  });
};

export const gitlabUnapproveMr = async ({
  workspaceId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<GitlabMrApprovalState | null> => {
  return invoke<GitlabMrApprovalState | null>('gitlab_unapprove_mr', {
    workspaceId,
    host,
    projectPath,
    mrIid,
  });
};

export type GitlabMrStateEvent = 'close' | 'reopen';

type UpdateMrStateParams = MrTarget & {
  readonly stateEvent?: GitlabMrStateEvent;
  readonly title?: string;
};

export const gitlabUpdateMrState = async ({
  workspaceId,
  host,
  projectPath,
  mrIid,
  stateEvent,
  title,
}: UpdateMrStateParams): Promise<GitlabMergeRequest> => {
  return invoke<GitlabMergeRequest>('gitlab_update_mr_state', {
    workspaceId,
    host,
    projectPath,
    mrIid,
    ...(stateEvent !== undefined && { stateEvent }),
    ...(title !== undefined && { title }),
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
