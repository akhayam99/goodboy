import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { IntegrationCredentialId, ProjectId, WorkspaceId } from '@goodboy/types';

type JiraAvatarUrls = {
  readonly '48x48': string | null;
  readonly '24x24': string | null;
};

export type JiraUser = {
  readonly accountId: string;
  readonly displayName: string;
  readonly emailAddress: string | null;
  readonly avatarUrls: JiraAvatarUrls | null;
  readonly active: boolean | null;
};

export type JiraStatusCategoryKey = 'new' | 'indeterminate' | 'done' | '';

export type JiraIssue = {
  readonly id: string;
  readonly key: string;
  readonly summary: string;
  readonly description: string;
  readonly status: string;
  readonly statusCategory: JiraStatusCategoryKey;
  readonly issueType: string;
  readonly priority: string | null;
  readonly assignee: JiraUser | null;
  readonly reporter: JiraUser | null;
  readonly labels: ReadonlyArray<string>;
  readonly created: string;
  readonly updated: string;
  readonly url: string;
};

export type JiraComment = {
  readonly id: string;
  readonly author: JiraUser | null;
  readonly body: string;
  readonly created: string;
  readonly updated: string;
};

type JiraTransitionTarget = {
  readonly id: string;
  readonly name: string;
};

export type JiraTransition = {
  readonly id: string;
  readonly name: string;
  readonly to: JiraTransitionTarget | null;
  readonly hasScreen: boolean;
};

type JiraSite = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly siteUrl: string;
  readonly email: string;
};

export type JiraIssueTarget = JiraSite & {
  readonly issueKey: string;
};

type ValidateParams = {
  readonly credentialId: IntegrationCredentialId;
  readonly siteUrl: string;
  readonly email: string;
  readonly apiToken: string | null;
};

export const jiraValidateConnection = async ({
  credentialId,
  siteUrl,
  email,
  apiToken,
}: ValidateParams): Promise<JiraUser> =>
  invokeCommand<JiraUser>('jira_validate_connection', { credentialId, siteUrl, email, apiToken });

export type JiraProject = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
};

export const jiraListProjects = async ({
  credentialId,
  siteUrl,
  email,
  apiToken,
}: ValidateParams): Promise<ReadonlyArray<JiraProject>> =>
  invokeCommand<ReadonlyArray<JiraProject>>('jira_list_projects', {
    credentialId,
    siteUrl,
    email,
    apiToken,
  });

type ConnectParams = {
  readonly credentialId: IntegrationCredentialId;
  readonly apiToken: string | null;
};

export const jiraConnect = async ({ credentialId, apiToken }: ConnectParams): Promise<void> => {
  await invokeCommand('jira_connect', { credentialId, apiToken });
};

type ListIssuesParams = JiraSite & {
  readonly projectKey: string;
  readonly assignedOnly: boolean;
};

export const jiraListIssues = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  projectKey,
  assignedOnly,
}: ListIssuesParams): Promise<ReadonlyArray<JiraIssue>> =>
  invokeCommand<ReadonlyArray<JiraIssue>>('jira_list_issues', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    projectKey,
    assignedOnly,
  });

export const jiraGetIssue = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  issueKey,
}: JiraIssueTarget): Promise<JiraIssue> =>
  invokeCommand<JiraIssue>('jira_get_issue', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    issueKey,
  });

type GetIssuesParams = JiraSite & {
  readonly issueKeys: ReadonlyArray<string>;
};

export const jiraGetIssues = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  issueKeys,
}: GetIssuesParams): Promise<ReadonlyArray<JiraIssue>> =>
  invokeCommand<ReadonlyArray<JiraIssue>>('jira_get_issues', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    issueKeys,
  });

export const jiraListComments = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  issueKey,
}: JiraIssueTarget): Promise<ReadonlyArray<JiraComment>> =>
  invokeCommand<ReadonlyArray<JiraComment>>('jira_list_comments', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    issueKey,
  });

type CreateCommentParams = JiraIssueTarget & {
  readonly body: string;
};

export const jiraCreateComment = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  issueKey,
  body,
}: CreateCommentParams): Promise<JiraComment> =>
  invokeCommand<JiraComment>('jira_create_comment', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    issueKey,
    body,
  });

type UpdateDescriptionParams = JiraIssueTarget & {
  readonly description: string;
};

export const jiraUpdateIssueDescription = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  issueKey,
  description,
}: UpdateDescriptionParams): Promise<void> => {
  await invokeCommand('jira_update_issue', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    issueKey,
    description,
  });
};

type SetAssigneeParams = JiraIssueTarget & {
  readonly accountId: string | null;
};

export const jiraSetAssignee = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  issueKey,
  accountId,
}: SetAssigneeParams): Promise<void> => {
  await invokeCommand('jira_set_assignee', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    issueKey,
    accountId,
  });
};

type AssignableParams = JiraIssueTarget & {
  readonly query?: string;
};

export const jiraListAssignableUsers = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  issueKey,
  query,
}: AssignableParams): Promise<ReadonlyArray<JiraUser>> =>
  invokeCommand<ReadonlyArray<JiraUser>>('jira_list_assignable_users', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    issueKey,
    query: query ?? null,
  });

export const jiraListTransitions = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  issueKey,
}: JiraIssueTarget): Promise<ReadonlyArray<JiraTransition>> =>
  invokeCommand<ReadonlyArray<JiraTransition>>('jira_list_transitions', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    issueKey,
  });

type TransitionParams = JiraIssueTarget & {
  readonly transitionId: string;
};

export const jiraTransitionIssue = async ({
  workspaceId,
  projectId,
  siteUrl,
  email,
  issueKey,
  transitionId,
}: TransitionParams): Promise<void> => {
  await invokeCommand('jira_transition_issue', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    siteUrl,
    email,
    issueKey,
    transitionId,
  });
};
