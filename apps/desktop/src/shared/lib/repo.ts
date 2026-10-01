import { invokeCommand } from './invokeCommand';
import type { FastForwardResult, RemoteProbe, WorkspaceGitStatus } from '@goodboy/types';

export type GitRepoCheck = {
  readonly isRepo: boolean;
  readonly rootPath: string | null;
  readonly resolvedPath: string | null;
  readonly error: string | null;
};

export const validateGitRepo = async (path: string): Promise<GitRepoCheck> => {
  return invokeCommand<GitRepoCheck>('validate_git_repo', { path });
};

type ProjectGitStatusParams = {
  readonly projectPath: string;
};

export const projectGitStatus = async ({
  projectPath,
}: ProjectGitStatusParams): Promise<WorkspaceGitStatus> => {
  return invokeCommand<WorkspaceGitStatus>('project_git_status', { projectPath });
};

type ProjectFetchParams = {
  readonly projectPath: string;
  readonly workspaceId?: string;
  readonly projectId?: string;
};

export const projectFetch = async ({
  projectPath,
  workspaceId,
  projectId,
}: ProjectFetchParams): Promise<void> => {
  return invokeCommand<void>('project_fetch', { projectPath, workspaceId, projectId });
};

type ProjectRemoteProbeParams = {
  readonly projectPath: string;
  readonly workspaceId?: string;
  readonly projectId?: string;
};

export const projectRemoteProbe = async ({
  projectPath,
  workspaceId,
  projectId,
}: ProjectRemoteProbeParams): Promise<RemoteProbe> => {
  return invokeCommand<RemoteProbe>('project_remote_probe', {
    projectPath,
    workspaceId,
    projectId,
  });
};

type CheckoutFastForwardParams = {
  readonly checkoutPath: string;
  readonly workspaceId?: string;
  readonly projectId?: string;
};

export const checkoutFastForward = async ({
  checkoutPath,
  workspaceId,
  projectId,
}: CheckoutFastForwardParams): Promise<FastForwardResult> => {
  return invokeCommand<FastForwardResult>('checkout_fast_forward', {
    checkoutPath,
    workspaceId,
    projectId,
  });
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
  return invokeCommand<ReadonlyArray<ChildRepo>>('scan_child_repos', { path });
};

export type RepoIdentity = {
  readonly rootCommits: ReadonlyArray<string>;
  readonly remoteUrl: string | null;
};

type RepoIdentityParams = {
  readonly path: string;
};

export const repoIdentity = async ({ path }: RepoIdentityParams): Promise<RepoIdentity> => {
  return invokeCommand<RepoIdentity>('repo_identity', { path });
};

export type MovedProjectVerdict =
  'same_repository' | 'same_name_unconfirmed' | 'different_repository' | 'not_found';

type MovedProjectInput = {
  readonly id: string;
  readonly name: string;
  readonly rootCommit?: string;
  readonly remoteUrl?: string;
};

export type MovedProjectMatch = {
  readonly projectId: string;
  readonly path: string | null;
  readonly verdict: MovedProjectVerdict;
  readonly identity: RepoIdentity | null;
};

type FindMovedProjectsParams = {
  readonly parent: string;
  readonly projects: ReadonlyArray<MovedProjectInput>;
};

export const findMovedProjects = async ({
  parent,
  projects,
}: FindMovedProjectsParams): Promise<ReadonlyArray<MovedProjectMatch>> => {
  return invokeCommand<ReadonlyArray<MovedProjectMatch>>('find_moved_projects', {
    args: { parent, projects },
  });
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
  return invokeCommand<InitializedRepo>('repo_init_with_remote', { args: { path, remoteUrl } });
};

type InitPlainRepoParams = {
  readonly path: string;
};

export const initRepo = async ({ path }: InitPlainRepoParams): Promise<InitializedRepo> => {
  return invokeCommand<InitializedRepo>('repo_init', { path });
};
