import { invokeCommand } from './invokeCommand';
import type {
  BootstrapAlignOutcome,
  BootstrapClearReport,
  BootstrapPrepared,
  BootstrapRecoverState,
  FastForwardResult,
  LinkedRemote,
  PublishOutcome,
  RemoteProbe,
  WorkspaceGitStatus,
} from '@goodboy/types';

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

type ProjectLinkRemoteParams = {
  readonly projectPath: string;
  readonly remoteUrl: string;
};

export const projectLinkRemote = async ({
  projectPath,
  remoteUrl,
}: ProjectLinkRemoteParams): Promise<LinkedRemote> => {
  return invokeCommand<LinkedRemote>('project_link_remote', { projectPath, remoteUrl });
};

type ProjectPublishMainParams = {
  readonly projectPath: string;
  readonly workspaceId?: string;
  readonly projectId?: string;
};

export const projectPublishMain = async ({
  projectPath,
  workspaceId,
  projectId,
}: ProjectPublishMainParams): Promise<PublishOutcome> => {
  return invokeCommand<PublishOutcome>('project_publish_main', {
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

type ProjectFolderCreateParams = {
  readonly parentPath: string;
  readonly name: string;
};

export const projectFolderCreate = async ({
  parentPath,
  name,
}: ProjectFolderCreateParams): Promise<InitializedRepo> => {
  return invokeCommand<InitializedRepo>('project_folder_create', { parentPath, name });
};

type InitPlainRepoParams = {
  readonly path: string;
};

export const initRepo = async ({ path }: InitPlainRepoParams): Promise<InitializedRepo> => {
  return invokeCommand<InitializedRepo>('repo_init', { path });
};

type BootstrapPrepareParams = {
  readonly projectPath: string;
  readonly projectKey: string;
  readonly branch: string;
  readonly baseBranch: string;
};

export const bootstrapPrepare = async (
  params: BootstrapPrepareParams,
): Promise<BootstrapPrepared> => {
  return invokeCommand<BootstrapPrepared>('bootstrap_prepare', { args: params });
};

type BootstrapApplyParams = {
  readonly projectPath: string;
  readonly snapshotId: string;
  readonly worktreePath: string;
  readonly baseBranch: string;
};

export const bootstrapApply = async (params: BootstrapApplyParams): Promise<void> => {
  return invokeCommand<void>('bootstrap_apply', { args: params });
};

type BootstrapClearRootParams = {
  readonly projectPath: string;
  readonly snapshotId: string;
  readonly worktreePath: string;
};

export const bootstrapClearRoot = async ({
  projectPath,
  snapshotId,
  worktreePath,
}: BootstrapClearRootParams): Promise<BootstrapClearReport> => {
  return invokeCommand<BootstrapClearReport>('bootstrap_clear_root', {
    projectPath,
    snapshotId,
    worktreePath,
  });
};

type BootstrapAlignMainParams = {
  readonly projectPath: string;
  readonly baseBranch: string;
};

export const bootstrapAlignMain = async ({
  projectPath,
  baseBranch,
}: BootstrapAlignMainParams): Promise<BootstrapAlignOutcome> => {
  return invokeCommand<BootstrapAlignOutcome>('bootstrap_align_main', { projectPath, baseBranch });
};

type BootstrapRecoverParams = {
  readonly projectPath: string;
  readonly snapshotId: string;
  readonly worktreePath: string;
};

export const bootstrapRecover = async ({
  projectPath,
  snapshotId,
  worktreePath,
}: BootstrapRecoverParams): Promise<BootstrapRecoverState> => {
  return invokeCommand<BootstrapRecoverState>('bootstrap_recover', {
    projectPath,
    snapshotId,
    worktreePath,
  });
};

type BootstrapRollbackParams = {
  readonly projectPath: string;
  readonly worktreePath: string;
  readonly branch: string;
};

export const bootstrapRollback = async ({
  projectPath,
  worktreePath,
  branch,
}: BootstrapRollbackParams): Promise<void> => {
  return invokeCommand<void>('bootstrap_rollback', { projectPath, worktreePath, branch });
};
