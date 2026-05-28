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
