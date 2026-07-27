import { invoke } from '@tauri-apps/api/core';

export type GitRepoCheck = {
  readonly isRepo: boolean;
  readonly rootPath: string | null;
  readonly error: string | null;
};

export const validateGitRepo = async (path: string): Promise<GitRepoCheck> => {
  return invoke<GitRepoCheck>('validate_git_repo', { path });
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
