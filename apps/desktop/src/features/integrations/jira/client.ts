import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';

export type JiraAvatarUrls = {
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

export type JiraTransitionTarget = {
  readonly id: string;
  readonly name: string;
};

export type JiraTransition = {
  readonly id: string;
  readonly name: string;
  readonly to: JiraTransitionTarget | null;
  readonly hasScreen: boolean;
};

export type JiraSite = {
  readonly workspaceId: WorkspaceId;
  readonly siteUrl: string;
  readonly email: string;
};

export type JiraIssueTarget = JiraSite & {
  readonly issueKey: string;
};

type ValidateParams = {
  readonly workspaceId: WorkspaceId;
  readonly siteUrl: string;
  readonly email: string;
  readonly apiToken: string;
};

export const jiraValidateConnection = async ({
  workspaceId,
  siteUrl,
  email,
  apiToken,
}: ValidateParams): Promise<JiraUser> =>
  invoke<JiraUser>('jira_validate_connection', { workspaceId, siteUrl, email, apiToken });

type DisconnectParams = {
  readonly workspaceId: WorkspaceId;
};

export const jiraDisconnect = async ({ workspaceId }: DisconnectParams): Promise<void> => {
  await invoke('jira_disconnect', { workspaceId });
};

type ListIssuesParams = JiraSite & {
  readonly projectKey: string;
  readonly assignedOnly: boolean;
};

export const jiraListIssues = async ({
  workspaceId,
  siteUrl,
  email,
  projectKey,
  assignedOnly,
}: ListIssuesParams): Promise<ReadonlyArray<JiraIssue>> =>
  invoke<ReadonlyArray<JiraIssue>>('jira_list_issues', {
    workspaceId,
    siteUrl,
    email,
    projectKey,
    assignedOnly,
  });

export const jiraGetIssue = async ({
  workspaceId,
  siteUrl,
  email,
  issueKey,
}: JiraIssueTarget): Promise<JiraIssue> =>
  invoke<JiraIssue>('jira_get_issue', { workspaceId, siteUrl, email, issueKey });

export const jiraListComments = async ({
  workspaceId,
  siteUrl,
  email,
  issueKey,
}: JiraIssueTarget): Promise<ReadonlyArray<JiraComment>> =>
  invoke<ReadonlyArray<JiraComment>>('jira_list_comments', {
    workspaceId,
    siteUrl,
    email,
    issueKey,
  });

type CreateCommentParams = JiraIssueTarget & {
  readonly body: string;
};

export const jiraCreateComment = async ({
  workspaceId,
  siteUrl,
  email,
  issueKey,
  body,
}: CreateCommentParams): Promise<JiraComment> =>
  invoke<JiraComment>('jira_create_comment', { workspaceId, siteUrl, email, issueKey, body });

type UpdateDescriptionParams = JiraIssueTarget & {
  readonly description: string;
};

export const jiraUpdateIssueDescription = async ({
  workspaceId,
  siteUrl,
  email,
  issueKey,
  description,
}: UpdateDescriptionParams): Promise<void> => {
  await invoke('jira_update_issue', { workspaceId, siteUrl, email, issueKey, description });
};

type SetAssigneeParams = JiraIssueTarget & {
  readonly accountId: string | null;
};

export const jiraSetAssignee = async ({
  workspaceId,
  siteUrl,
  email,
  issueKey,
  accountId,
}: SetAssigneeParams): Promise<void> => {
  await invoke('jira_set_assignee', { workspaceId, siteUrl, email, issueKey, accountId });
};

type AssignableParams = JiraIssueTarget & {
  readonly query?: string;
};

export const jiraListAssignableUsers = async ({
  workspaceId,
  siteUrl,
  email,
  issueKey,
  query,
}: AssignableParams): Promise<ReadonlyArray<JiraUser>> =>
  invoke<ReadonlyArray<JiraUser>>('jira_list_assignable_users', {
    workspaceId,
    siteUrl,
    email,
    issueKey,
    query: query ?? null,
  });

export const jiraListTransitions = async ({
  workspaceId,
  siteUrl,
  email,
  issueKey,
}: JiraIssueTarget): Promise<ReadonlyArray<JiraTransition>> =>
  invoke<ReadonlyArray<JiraTransition>>('jira_list_transitions', {
    workspaceId,
    siteUrl,
    email,
    issueKey,
  });

type TransitionParams = JiraIssueTarget & {
  readonly transitionId: string;
};

export const jiraTransitionIssue = async ({
  workspaceId,
  siteUrl,
  email,
  issueKey,
  transitionId,
}: TransitionParams): Promise<void> => {
  await invoke('jira_transition_issue', {
    workspaceId,
    siteUrl,
    email,
    issueKey,
    transitionId,
  });
};
