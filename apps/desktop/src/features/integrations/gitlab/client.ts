import { invoke } from '@tauri-apps/api/core';
import type { IntegrationCredentialId, ProjectId, WorkspaceId } from '@goodboy/types';

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

export const gitlabValidateConnection = async (
  credentialId: IntegrationCredentialId,
  host: string,
  token: string | null,
): Promise<GitlabUser> => {
  return invoke<GitlabUser>('gitlab_validate_connection', { credentialId, host, token });
};

export const gitlabConnect = async (
  credentialId: IntegrationCredentialId,
  token: string | null,
): Promise<void> => {
  await invoke('gitlab_connect', { credentialId, token });
};

export const gitlabFetchAssignedIssues = async (
  workspaceId: WorkspaceId,
  host: string,
  projectId?: ProjectId,
): Promise<GitlabIssue[]> => {
  return invoke<GitlabIssue[]>('gitlab_fetch_assigned_issues', {
    workspaceId,
    host,
    ...(projectId != null ? { projectId } : {}),
  });
};

export const gitlabFetchIssue = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  issueIid: number,
  projectId?: ProjectId,
): Promise<GitlabIssue> => {
  return invoke<GitlabIssue>('gitlab_fetch_issue', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    issueIid,
  });
};

type UpdateDescriptionParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly host: string;
  readonly projectPath: string;
  readonly issueIid: number;
  readonly description: string;
};

export const gitlabUpdateIssueDescription = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  issueIid,
  description,
}: UpdateDescriptionParams): Promise<string> => {
  return invoke<string>('gitlab_update_issue', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
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

type GitlabMrAuthor = {
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
  projectId?: ProjectId,
): Promise<GitlabMergeRequest[]> => {
  return invoke<GitlabMergeRequest[]>('gitlab_fetch_assigned_mrs', {
    workspaceId,
    host,
    ...(projectId != null ? { projectId } : {}),
  });
};

export const gitlabFetchProjectMrs = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  projectId?: ProjectId,
): Promise<GitlabMergeRequest[]> => {
  return invoke<GitlabMergeRequest[]>('gitlab_fetch_project_mrs', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
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
  projectId?: ProjectId,
): Promise<GitlabMergeRequest | null> => {
  return invoke<GitlabMergeRequest | null>('gitlab_mr_for_branch', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    sourceBranch,
  });
};

export const gitlabCreateMr = async (args: {
  workspaceId: WorkspaceId;
  projectId?: ProjectId;
  host: string;
  projectPath: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  draft: boolean;
}): Promise<GitlabMergeRequest> => {
  const { projectId, ...payload } = args;
  return invoke<GitlabMergeRequest>('gitlab_create_mr', {
    ...payload,
    ...(projectId != null ? { projectId } : {}),
  });
};

export const gitlabMrDiff = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  mrIid: number,
  projectId?: ProjectId,
): Promise<string> => {
  return invoke<string>('gitlab_mr_diff', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
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
  projectId?: ProjectId,
): Promise<GitlabDiffRefs> => {
  return invoke<GitlabDiffRefs>('gitlab_mr_diff_refs', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
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
  projectId?: ProjectId,
): Promise<string> => {
  return invoke<string>('gitlab_create_mr_discussion', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
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
  projectId?: ProjectId,
): Promise<number> => {
  return invoke<number>('gitlab_create_mr_note', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
    body,
  });
};

type GitlabNotePosition = {
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

type GitlabMrApproval = {
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
  readonly projectId?: ProjectId;
  readonly host: string;
  readonly projectPath: string;
  readonly mrIid: number;
};

export const gitlabListMrDiscussions = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<ReadonlyArray<GitlabMrDiscussion>> => {
  return invoke<ReadonlyArray<GitlabMrDiscussion>>('gitlab_list_mr_discussions', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
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
  projectId,
  host,
  projectPath,
  mrIid,
  discussionId,
  body,
}: ReplyParams): Promise<number> => {
  return invoke<number>('gitlab_reply_to_mr_discussion', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
    discussionId,
    body,
  });
};

type ResolveDiscussionParams = MrTarget & {
  readonly discussionId: string;
  readonly resolved: boolean;
};

export const gitlabResolveMrDiscussion = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
  discussionId,
  resolved,
}: ResolveDiscussionParams): Promise<GitlabMrDiscussion> => {
  return invoke<GitlabMrDiscussion>('gitlab_resolve_mr_discussion', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
    discussionId,
    resolved,
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
  readonly projectId?: ProjectId;
  readonly host: string;
  readonly projectPath: string;
  readonly issueIid: number;
};

export const gitlabListIssueNotes = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  issueIid,
}: IssueTarget): Promise<ReadonlyArray<GitlabIssueNote>> => {
  return invoke<ReadonlyArray<GitlabIssueNote>>('gitlab_list_issue_notes', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
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
  projectId,
  host,
  projectPath,
  issueIid,
  body,
}: CreateIssueNoteParams): Promise<number> => {
  return invoke<number>('gitlab_create_issue_note', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    issueIid,
    body,
  });
};

export const gitlabMrApprovalState = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<GitlabMrApprovalState | null> => {
  return invoke<GitlabMrApprovalState | null>('gitlab_mr_approval_state', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
  });
};

export const gitlabApproveMr = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<GitlabMrApprovalState | null> => {
  return invoke<GitlabMrApprovalState | null>('gitlab_approve_mr', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
  });
};

export const gitlabUnapproveMr = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<GitlabMrApprovalState | null> => {
  return invoke<GitlabMrApprovalState | null>('gitlab_unapprove_mr', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
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
  projectId,
  host,
  projectPath,
  mrIid,
  stateEvent,
  title,
}: UpdateMrStateParams): Promise<GitlabMergeRequest> => {
  return invoke<GitlabMergeRequest>('gitlab_update_mr_state', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
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
  projectId?: ProjectId,
): Promise<GitlabMergeRequest> => {
  return invoke<GitlabMergeRequest>('gitlab_merge_mr', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
  });
};
