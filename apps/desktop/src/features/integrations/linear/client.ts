import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';

export type LinearViewer = {
  id: string;
  name: string;
  email: string;
  organization: {
    urlKey: string;
    name: string;
  };
};

type LinearIssueState = {
  name: string;
  type: string;
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
  user: { name: string } | null;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly issueId: string;
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

export const linearConnect = async (
  workspaceId: WorkspaceId,
  token: string,
): Promise<LinearViewer> => {
  return invoke<LinearViewer>('linear_connect', { workspaceId, token });
};

export const linearDisconnect = async (workspaceId: WorkspaceId): Promise<void> => {
  await invoke('linear_disconnect', { workspaceId });
};

export const linearFetchAssignedIssues = async (
  workspaceId: WorkspaceId,
  teamId?: string,
): Promise<LinearIssue[]> => {
  return invoke<LinearIssue[]>('linear_fetch_assigned_issues', {
    workspaceId,
    teamId: teamId ?? null,
  });
};

export const linearFetchIssue = async ({ workspaceId, issueId }: Params): Promise<LinearIssue> => {
  return invoke<LinearIssue>('linear_fetch_issue', { workspaceId, issueId });
};

export const linearFetchIssueComments = async ({
  workspaceId,
  issueId,
}: Params): Promise<LinearIssueComment[]> => {
  return invoke<LinearIssueComment[]>('linear_fetch_issue_comments', { workspaceId, issueId });
};

type UpdateDescriptionParams = Params & {
  readonly description: string;
};

export const linearUpdateIssueDescription = async ({
  workspaceId,
  issueId,
  description,
}: UpdateDescriptionParams): Promise<string> => {
  return invoke<string>('linear_update_issue', { workspaceId, issueId, description });
};
