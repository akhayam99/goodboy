import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { IntegrationCredentialId, ProjectId, WorkspaceId } from '@goodboy/types';

export type LinearViewer = {
  id: string;
  name: string;
  email: string;
  organization: {
    urlKey: string;
    name: string;
  };
};

export type LinearIssueState = {
  name: string;
  type: string;
};

export type LinearWorkflowState = {
  id: string;
  name: string;
  type: string;
  position: number;
};

export type LinearTeamMember = {
  id: string;
  name: string;
  active: boolean;
};

export type LinearIssuePerson = {
  name: string;
};

export type LinearIssueLabel = {
  name: string;
  color: string;
};

export type LinearAttachment = {
  id: string;
  title: string | null;
  url: string;
  sourceType: string | null;
  metadata: Record<string, unknown> | null;
};

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
  state: LinearIssueState;
  team: { key: string };
  priority?: number | null;
  priorityLabel?: string | null;
  assignee?: { name: string } | null;
  creator?: { name: string } | null;
  project?: { name: string } | null;
  labels?: { nodes: ReadonlyArray<LinearIssueLabel> };
  updatedAt: string;
  branchName?: string;
  attachments?: { nodes: ReadonlyArray<LinearAttachment> };
};

export type LinearIssueComment = {
  id: string;
  body: string;
  createdAt: string;
  parent: { id: string } | null;
  user: { name: string; avatarUrl: string | null } | null;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly issueId: string;
  readonly projectId?: ProjectId;
};

export type LinearLinkedPr = {
  readonly url: string;
  readonly number: number;
  readonly repo: string | null;
  readonly status: string | null;
};

const PR_URL_RE = /\/(?:pull|merge_requests)\/(\d+)/;
const GH_REPO_RE = /github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/pull\/\d+/;

export const prRepoFromUrl = (url: string): string | null => {
  return url.match(GH_REPO_RE)?.[1] ?? null;
};

export const issuePullRequests = (issue: LinearIssue): ReadonlyArray<LinearLinkedPr> => {
  const out: LinearLinkedPr[] = [];
  const seen = new Set<number>();
  for (const attachment of issue.attachments?.nodes ?? []) {
    const match = attachment.url.match(PR_URL_RE);
    if (!match) {
      continue;
    }
    const number = Number(match[1]);
    if (seen.has(number)) {
      continue;
    }
    seen.add(number);
    const rawStatus = attachment.metadata?.status;
    out.push({
      url: attachment.url,
      number,
      repo: prRepoFromUrl(attachment.url),
      status: typeof rawStatus === 'string' ? rawStatus : null,
    });
  }
  return out;
};

export const linearValidateConnection = async (
  credentialId: IntegrationCredentialId,
  token: string | null,
): Promise<LinearViewer> => {
  return invokeCommand<LinearViewer>('linear_validate_connection', { credentialId, token });
};

export const linearConnect = async (
  credentialId: IntegrationCredentialId,
  token: string | null,
): Promise<void> => {
  await invokeCommand('linear_connect', { credentialId, token });
};

export const linearFetchAssignedIssues = async (
  workspaceId: WorkspaceId,
  teamId?: string,
  projectId?: ProjectId,
): Promise<LinearIssue[]> => {
  return invokeCommand<LinearIssue[]>('linear_fetch_assigned_issues', {
    workspaceId,
    teamId: teamId ?? null,
    ...(projectId != null ? { projectId } : {}),
  });
};

export const linearFetchIssue = async ({
  workspaceId,
  issueId,
  projectId,
}: Params): Promise<LinearIssue> => {
  return invokeCommand<LinearIssue>('linear_fetch_issue', {
    workspaceId,
    issueId,
    ...(projectId != null ? { projectId } : {}),
  });
};

type FetchByIdsParams = {
  readonly workspaceId: WorkspaceId;
  readonly issueIds: ReadonlyArray<string>;
  readonly projectId?: ProjectId;
};

export const linearFetchIssuesByIds = async ({
  workspaceId,
  issueIds,
  projectId,
}: FetchByIdsParams): Promise<LinearIssue[]> => {
  return invokeCommand<LinearIssue[]>('linear_fetch_issues_by_ids', {
    workspaceId,
    issueIds,
    ...(projectId != null ? { projectId } : {}),
  });
};

type FetchTeamKeysParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
};

export const linearFetchTeamKeys = async ({
  workspaceId,
  projectId,
}: FetchTeamKeysParams): Promise<ReadonlyArray<string>> => {
  return invokeCommand<ReadonlyArray<string>>('linear_fetch_team_keys', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
  });
};

export const linearFetchIssueComments = async ({
  workspaceId,
  issueId,
  projectId,
}: Params): Promise<LinearIssueComment[]> => {
  return invokeCommand<LinearIssueComment[]>('linear_fetch_issue_comments', {
    workspaceId,
    issueId,
    ...(projectId != null ? { projectId } : {}),
  });
};

type CreateCommentParams = Params & {
  readonly body: string;
  readonly parentId: string | null;
};

export const linearCreateComment = async ({
  workspaceId,
  issueId,
  body,
  parentId,
  projectId,
}: CreateCommentParams): Promise<LinearIssueComment> => {
  return invokeCommand<LinearIssueComment>('linear_create_comment', {
    workspaceId,
    issueId,
    body,
    parentId,
    ...(projectId != null ? { projectId } : {}),
  });
};

type UpdateDescriptionParams = Params & {
  readonly description: string;
};

export const linearUpdateIssueDescription = async ({
  workspaceId,
  issueId,
  description,
  projectId,
}: UpdateDescriptionParams): Promise<string> => {
  return invokeCommand<string>('linear_update_issue', {
    workspaceId,
    issueId,
    description,
    ...(projectId != null ? { projectId } : {}),
  });
};

export const linearFetchTeamStates = async ({
  workspaceId,
  issueId,
  projectId,
}: Params): Promise<ReadonlyArray<LinearWorkflowState>> => {
  return invokeCommand<ReadonlyArray<LinearWorkflowState>>('linear_fetch_team_states', {
    workspaceId,
    issueId,
    ...(projectId != null ? { projectId } : {}),
  });
};

type UpdateStateParams = Params & {
  readonly stateId: string;
};

export const linearUpdateIssueState = async ({
  workspaceId,
  issueId,
  stateId,
  projectId,
}: UpdateStateParams): Promise<LinearIssueState> => {
  return invokeCommand<LinearIssueState>('linear_update_issue_state', {
    workspaceId,
    issueId,
    stateId,
    ...(projectId != null ? { projectId } : {}),
  });
};

export const linearFetchTeamMembers = async ({
  workspaceId,
  issueId,
  projectId,
}: Params): Promise<ReadonlyArray<LinearTeamMember>> => {
  return invokeCommand<ReadonlyArray<LinearTeamMember>>('linear_fetch_team_members', {
    workspaceId,
    issueId,
    ...(projectId != null ? { projectId } : {}),
  });
};

type UpdateAssigneeParams = Params & {
  readonly assigneeId: string | null;
};

export const linearUpdateIssueAssignee = async ({
  workspaceId,
  issueId,
  assigneeId,
  projectId,
}: UpdateAssigneeParams): Promise<LinearIssuePerson | null> => {
  return invokeCommand<LinearIssuePerson | null>('linear_update_issue_assignee', {
    workspaceId,
    issueId,
    assigneeId,
    ...(projectId != null ? { projectId } : {}),
  });
};
