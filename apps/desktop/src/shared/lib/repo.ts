import { invoke } from '@tauri-apps/api/core';
import type { FastForwardResult, WorkspaceGitStatus } from '@goodboy/types';

export type GitRepoCheck = {
  readonly isRepo: boolean;
  readonly rootPath: string | null;
  readonly resolvedPath: string | null;
  readonly error: string | null;
};

export const validateGitRepo = async (path: string): Promise<GitRepoCheck> => {
  return invoke<GitRepoCheck>('validate_git_repo', { path });
};

type ProjectGitStatusParams = {
  readonly projectPath: string;
};

export const projectGitStatus = async ({
  projectPath,
}: ProjectGitStatusParams): Promise<WorkspaceGitStatus> => {
  return invoke<WorkspaceGitStatus>('project_git_status', { projectPath });
};

type CheckoutFastForwardParams = {
  readonly checkoutPath: string;
};

export const checkoutFastForward = async ({
  checkoutPath,
}: CheckoutFastForwardParams): Promise<FastForwardResult> => {
  return invoke<FastForwardResult>('checkout_fast_forward', { checkoutPath });
};

export type ChildRepo = {
  readonly name: string;
  readonly path: string;
};

type ScanChildReposParams = {
  readonly path: string;
};

export const scanChildRepos = async ({
  path,
}: ScanChildReposParams): Promise<ReadonlyArray<ChildRepo>> => {
  return invoke<ReadonlyArray<ChildRepo>>('scan_child_repos', { path });
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

type InitPlainRepoParams = {
  readonly path: string;
};

export const initRepo = async ({ path }: InitPlainRepoParams): Promise<InitializedRepo> => {
  return invoke<InitializedRepo>('repo_init', { path });
};
