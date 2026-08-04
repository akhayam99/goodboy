import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceGitStatus } from '@goodboy/types';

export type GitRepoCheck = {
  readonly isRepo: boolean;
  readonly rootPath: string | null;
  readonly resolvedPath: string | null;
  readonly error: string | null;
};

export const validateGitRepo = async (path: string): Promise<GitRepoCheck> => {
  return invoke<GitRepoCheck>('validate_git_repo', { path });
};

type WorkspaceGitStatusParams = {
  readonly workspacePath: string;
};

export const workspaceGitStatus = async ({
  workspacePath,
}: WorkspaceGitStatusParams): Promise<WorkspaceGitStatus> => {
  return invoke<WorkspaceGitStatus>('workspace_git_status', { workspacePath });
};

export type InitializedRepo = {
  readonly rootPath: string;
  readonly remoteUrl: string;
  readonly branch: string;
};

type InitRepoParams = {
  readonly path: string;
  readonly remoteUrl: string;
};

export const initRepoWithRemote = async ({
  path,
  remoteUrl,
}: InitRepoParams): Promise<InitializedRepo> => {
  return invoke<InitializedRepo>('repo_init_with_remote', { args: { path, remoteUrl } });
};
