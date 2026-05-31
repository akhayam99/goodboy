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
  updatedAt: string;
  branchName?: string;
  attachments?: { nodes: ReadonlyArray<LinearAttachment> };
};

export interface LinearLinkedPr {
  readonly url: string;
  readonly number: number;
  readonly repo: string | null;
  readonly status: string | null;
}

const PR_URL_RE = /\/(?:pull|merge_requests)\/(\d+)/;
const GH_REPO_RE = /github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/pull\/\d+/;

export function prRepoFromUrl(url: string): string | null {
  return url.match(GH_REPO_RE)?.[1] ?? null;
}

export function issuePullRequests(issue: LinearIssue): ReadonlyArray<LinearLinkedPr> {
  const out: LinearLinkedPr[] = [];
  const seen = new Set<number>();
  for (const attachment of issue.attachments?.nodes ?? []) {
    const match = attachment.url.match(PR_URL_RE);
    if (!match) continue;
    const number = Number(match[1]);
    if (seen.has(number)) continue;
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
}

export async function linearConnect(
  workspaceId: WorkspaceId,
  token: string,
): Promise<LinearViewer> {
  return invoke<LinearViewer>('linear_connect', { workspaceId, token });
}

export async function linearDisconnect(workspaceId: WorkspaceId): Promise<void> {
  await invoke('linear_disconnect', { workspaceId });
}

export async function linearFetchAssignedIssues(
  workspaceId: WorkspaceId,
  teamId?: string,
): Promise<LinearIssue[]> {
  return invoke<LinearIssue[]>('linear_fetch_assigned_issues', {
    workspaceId,
    teamId: teamId ?? null,
  });
}
