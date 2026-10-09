import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { IntegrationCredentialId, ProjectId, WorkspaceId } from '@goodboy/types';

export type GitlabUser = {
  id: number;
  username: string;
  name: string;
  avatarUrl?: string | null;
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
  return invokeCommand<GitlabUser>('gitlab_validate_connection', { credentialId, host, token });
};

export const gitlabConnect = async (
  credentialId: IntegrationCredentialId,
  token: string | null,
): Promise<void> => {
  await invokeCommand('gitlab_connect', { credentialId, token });
};

export const gitlabFetchAssignedIssues = async (
  workspaceId: WorkspaceId,
  host: string,
  projectId?: ProjectId,
): Promise<GitlabIssue[]> => {
  return invokeCommand<GitlabIssue[]>('gitlab_fetch_assigned_issues', {
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
  return invokeCommand<GitlabIssue>('gitlab_fetch_issue', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    issueIid,
  });
};

type FetchIssuesParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly host: string;
  readonly projectPath: string;
  readonly issueIids: ReadonlyArray<number>;
};

export const gitlabFetchIssues = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  issueIids,
}: FetchIssuesParams): Promise<GitlabIssue[]> => {
  return invokeCommand<GitlabIssue[]>('gitlab_fetch_issues', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    issueIids,
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
  return invokeCommand<string>('gitlab_update_issue', {
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

type GitlabMergeStatus =
  | 'unchecked'
  | 'checking'
  | 'can_be_merged'
  | 'cannot_be_merged'
  | 'cannot_be_merged_recheck'
  | null;

type GitlabMrAuthor = {
  id?: number | null;
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
  sha?: string | null;
  mergedAt?: string | null;
  author?: GitlabMrAuthor | null;
  reviewers?: ReadonlyArray<GitlabMrAuthor> | null;
  createdAt?: string | null;
  detailedMergeStatus?: string | null;
  headPipeline?: GitlabHeadPipeline | null;
};

type GitlabHeadPipeline = {
  id: number;
  status: string;
  webUrl?: string | null;
};

export const gitlabFetchAssignedMrs = async (
  workspaceId: WorkspaceId,
  host: string,
  projectId?: ProjectId,
): Promise<GitlabMergeRequest[]> => {
  return invokeCommand<GitlabMergeRequest[]>('gitlab_fetch_assigned_mrs', {
    workspaceId,
    host,
    ...(projectId != null ? { projectId } : {}),
  });
};

export const gitlabMrForBranch = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  sourceBranch: string,
  projectId?: ProjectId,
): Promise<GitlabMergeRequest | null> => {
  return invokeCommand<GitlabMergeRequest | null>('gitlab_mr_for_branch', {
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
  return invokeCommand<GitlabMergeRequest>('gitlab_create_mr', {
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
  return invokeCommand<string>('gitlab_mr_diff', {
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
  return invokeCommand<GitlabDiffRefs>('gitlab_mr_diff_refs', {
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
  return invokeCommand<string>('gitlab_create_mr_discussion', {
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
  return invokeCommand<number>('gitlab_create_mr_note', {
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
  return invokeCommand<ReadonlyArray<GitlabMrDiscussion>>('gitlab_list_mr_discussions', {
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
  return invokeCommand<number>('gitlab_reply_to_mr_discussion', {
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
  return invokeCommand<GitlabMrDiscussion>('gitlab_resolve_mr_discussion', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
    discussionId,
    resolved,
  });
};

type IssueTarget = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly host: string;
  readonly projectPath: string;
  readonly issueIid: number;
};

export const gitlabListIssueDiscussions = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  issueIid,
}: IssueTarget): Promise<ReadonlyArray<GitlabMrDiscussion>> => {
  return invokeCommand<ReadonlyArray<GitlabMrDiscussion>>('gitlab_list_issue_discussions', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    issueIid,
  });
};

type IssueReplyParams = IssueTarget & {
  readonly discussionId: string;
  readonly body: string;
};

export const gitlabReplyToIssueDiscussion = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  issueIid,
  discussionId,
  body,
}: IssueReplyParams): Promise<number> => {
  return invokeCommand<number>('gitlab_reply_to_issue_discussion', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    issueIid,
    discussionId,
    body,
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
  return invokeCommand<number>('gitlab_create_issue_note', {
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
  return invokeCommand<GitlabMrApprovalState | null>('gitlab_mr_approval_state', {
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
  return invokeCommand<GitlabMrApprovalState | null>('gitlab_approve_mr', {
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
  return invokeCommand<GitlabMrApprovalState | null>('gitlab_unapprove_mr', {
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
  return invokeCommand<GitlabMergeRequest>('gitlab_update_mr_state', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
    ...(stateEvent !== undefined && { stateEvent }),
    ...(title !== undefined && { title }),
  });
};

export type GitlabMergeMethod = 'merge' | 'squash' | 'rebase';

export const gitlabMergeMr = async (
  workspaceId: WorkspaceId,
  host: string,
  projectPath: string,
  mrIid: number,
  projectId?: ProjectId,
  method?: GitlabMergeMethod,
): Promise<GitlabMergeRequest> => {
  return invokeCommand<GitlabMergeRequest>('gitlab_merge_mr', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
    ...(method !== undefined ? { method } : {}),
  });
};

export const gitlabGetMr = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<GitlabMergeRequest> => {
  return invokeCommand<GitlabMergeRequest>('gitlab_get_mr', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
  });
};

type UpdateMrParams = MrTarget & {
  readonly title?: string;
  readonly description?: string;
  readonly reviewerIds?: ReadonlyArray<number>;
};

export const gitlabUpdateMr = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
  title,
  description,
  reviewerIds,
}: UpdateMrParams): Promise<GitlabMergeRequest> => {
  return invokeCommand<GitlabMergeRequest>('gitlab_update_mr', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(reviewerIds !== undefined && { reviewerIds }),
  });
};

export type GitlabMergeSettings = {
  mergeMethod: string;
  squashOption: string | null;
  onlyAllowMergeIfPipelineSucceeds: boolean;
};

type ProjectTarget = Omit<MrTarget, 'mrIid'>;

export const gitlabProjectMergeMethods = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
}: ProjectTarget): Promise<GitlabMergeSettings> => {
  return invokeCommand<GitlabMergeSettings>('gitlab_project_merge_methods', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
  });
};

export const gitlabSearchProjectUsers = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  query,
}: ProjectTarget & { readonly query: string }): Promise<ReadonlyArray<GitlabUser>> => {
  return invokeCommand<ReadonlyArray<GitlabUser>>('gitlab_search_project_users', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    query,
  });
};

type GitlabPipeline = {
  id: number;
  status: string;
  webUrl: string | null;
  sha: string | null;
};

export type GitlabJob = {
  id: number;
  name: string;
  stage: string | null;
  status: string;
  webUrl: string | null;
  allowFailure: boolean;
  duration: number | null;
};

export type GitlabMrChecks = {
  pipeline: GitlabPipeline | null;
  jobs: ReadonlyArray<GitlabJob>;
};

export const gitlabMrPipelineJobs = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<GitlabMrChecks | null> => {
  return invokeCommand<GitlabMrChecks | null>('gitlab_mr_pipeline_jobs', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
  });
};

export type GitlabMrCommit = {
  id: string;
  shortId: string;
  title: string;
  authorName: string | null;
  committedDate: string | null;
};

export const gitlabMrCommits = async ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
}: MrTarget): Promise<ReadonlyArray<GitlabMrCommit>> => {
  return invokeCommand<ReadonlyArray<GitlabMrCommit>>('gitlab_mr_commits', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    host,
    projectPath,
    mrIid,
  });
};
