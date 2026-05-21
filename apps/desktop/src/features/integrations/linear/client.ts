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

export type LinearTeam = {
  id: string;
  key: string;
  name: string;
};

export type LinearIssueState = {
  name: string;
  type: string;
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
};

export type LinearError = { kind: string; message: string };

export async function linearConnect(
  workspaceId: WorkspaceId,
  token: string,
): Promise<LinearViewer> {
  return invoke<LinearViewer>('linear_connect', { workspaceId, token });
}

export async function linearDisconnect(workspaceId: WorkspaceId): Promise<void> {
  await invoke('linear_disconnect', { workspaceId });
}

export async function linearHasToken(workspaceId: WorkspaceId): Promise<boolean> {
  return invoke<boolean>('linear_has_token', { workspaceId });
}

export async function linearFetchViewer(workspaceId: WorkspaceId): Promise<LinearViewer> {
  return invoke<LinearViewer>('linear_fetch_viewer', { workspaceId });
}

export async function linearFetchTeams(workspaceId: WorkspaceId): Promise<LinearTeam[]> {
  return invoke<LinearTeam[]>('linear_fetch_teams', { workspaceId });
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

export async function linearFetchIssue(
  workspaceId: WorkspaceId,
  issueId: string,
): Promise<LinearIssue> {
  return invoke<LinearIssue>('linear_fetch_issue', { workspaceId, issueId });
}
