import { invokeCommand } from '../../../shared/lib/invokeCommand';
import type { IntegrationCredentialId, ProjectId, WorkspaceId } from '@goodboy/types';

export type BitbucketUser = {
  readonly uuid: string;
  readonly accountId: string | null;
  readonly nickname: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
};

type BitbucketWorkspace = {
  readonly uuid: string;
  readonly slug: string;
  readonly name: string;
  readonly webUrl: string | null;
};

export type BitbucketConnection = {
  readonly user: BitbucketUser;
  readonly workspace: BitbucketWorkspace;
};

export type BitbucketPullRequestState = 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';

export type BitbucketParticipant = {
  readonly user: BitbucketUser | null;
  readonly role: string;
  readonly approved: boolean;
  readonly state: string | null;
};

export type BitbucketPullRequest = {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly state: BitbucketPullRequestState;
  readonly createdOn: string;
  readonly updatedOn: string;
  readonly sourceBranch: string;
  readonly sourceCommit: string | null;
  readonly destinationBranch: string;
  readonly destinationCommit: string | null;
  readonly author: BitbucketUser | null;
  readonly reviewers: ReadonlyArray<BitbucketUser>;
  readonly participants: ReadonlyArray<BitbucketParticipant>;
  readonly closeSourceBranch: boolean;
  readonly mergeCommit: string | null;
  readonly commentCount: number;
  readonly taskCount: number;
  readonly webUrl: string | null;
};

type BitbucketInline = {
  readonly path: string;
  readonly from: number | null;
  readonly to: number | null;
};

export type BitbucketComment = {
  readonly id: number;
  readonly body: string;
  readonly user: BitbucketUser | null;
  readonly createdOn: string;
  readonly updatedOn: string;
  readonly deleted: boolean;
  readonly parentId: number | null;
  readonly inline: BitbucketInline | null;
  readonly webUrl: string | null;
};

type BitbucketStatusState = 'SUCCESSFUL' | 'FAILED' | 'INPROGRESS' | 'STOPPED';

export type BitbucketStatus = {
  readonly key: string;
  readonly name: string;
  readonly state: BitbucketStatusState;
  readonly url: string | null;
  readonly description: string | null;
  readonly refname: string | null;
  readonly createdOn: string;
  readonly updatedOn: string;
};

type ValidateParams = {
  readonly credentialId: IntegrationCredentialId;
  readonly workspaceSlug: string;
  readonly email: string;
  readonly apiToken: string | null;
};

export const bitbucketValidateConnection = async ({
  credentialId,
  workspaceSlug,
  email,
  apiToken,
}: ValidateParams): Promise<BitbucketConnection> =>
  invokeCommand<BitbucketConnection>('bitbucket_validate_connection', {
    credentialId,
    workspaceSlug,
    email,
    apiToken,
  });

type ConnectParams = {
  readonly credentialId: IntegrationCredentialId;
  readonly apiToken: string | null;
};

export const bitbucketConnect = async ({
  credentialId,
  apiToken,
}: ConnectParams): Promise<void> => {
  await invokeCommand('bitbucket_connect', { credentialId, apiToken });
};

export type BitbucketRepo = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly workspaceSlug: string;
  readonly repoSlug: string;
  readonly email: string;
};

export type BitbucketPullRequestTarget = BitbucketRepo & {
  readonly pullRequestId: number;
};

type ListPullRequestsParams = BitbucketRepo & {
  readonly state?: BitbucketPullRequestState;
};

export const bitbucketListPullRequests = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  state,
}: ListPullRequestsParams): Promise<ReadonlyArray<BitbucketPullRequest>> =>
  invokeCommand<ReadonlyArray<BitbucketPullRequest>>('bitbucket_list_pull_requests', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    state: state ?? null,
  });

export const bitbucketGetPullRequest = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<BitbucketPullRequest> =>
  invokeCommand<BitbucketPullRequest>('bitbucket_get_pull_request', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });

export const bitbucketPullRequestDiff = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<string> =>
  invokeCommand<string>('bitbucket_pull_request_diff', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });

export const bitbucketListPullRequestComments = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<ReadonlyArray<BitbucketComment>> =>
  invokeCommand<ReadonlyArray<BitbucketComment>>('bitbucket_list_pull_request_comments', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });

export const bitbucketListPullRequestStatuses = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<ReadonlyArray<BitbucketStatus>> =>
  invokeCommand<ReadonlyArray<BitbucketStatus>>('bitbucket_list_pull_request_statuses', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });

type BranchParams = BitbucketRepo & {
  readonly sourceBranch: string;
};

export const bitbucketPullRequestForBranch = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  sourceBranch,
}: BranchParams): Promise<BitbucketPullRequest | null> =>
  invokeCommand<BitbucketPullRequest | null>('bitbucket_pull_request_for_branch', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    sourceBranch,
  });

export const bitbucketApprovePullRequest = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<BitbucketParticipant> =>
  invokeCommand<BitbucketParticipant>('bitbucket_approve_pull_request', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });

export const bitbucketUnapprovePullRequest = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<void> => {
  await invokeCommand('bitbucket_unapprove_pull_request', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });
};

export const bitbucketRequestChanges = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<BitbucketParticipant> =>
  invokeCommand<BitbucketParticipant>('bitbucket_request_changes', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });

export const bitbucketUnrequestChanges = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<void> => {
  await invokeCommand('bitbucket_unrequest_changes', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });
};

export type BitbucketMergeStrategyName = 'merge_commit' | 'squash' | 'rebase_merge';

type MergeParams = BitbucketPullRequestTarget & {
  readonly closeSourceBranch?: boolean;
  readonly message?: string;
  readonly strategy?: BitbucketMergeStrategyName;
};

export const bitbucketMergePullRequest = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
  closeSourceBranch,
  message,
  strategy,
}: MergeParams): Promise<BitbucketPullRequest> =>
  invokeCommand<BitbucketPullRequest>('bitbucket_merge_pull_request', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
    closeSourceBranch: closeSourceBranch ?? null,
    message: message ?? null,
    mergeStrategy: strategy ?? null,
  });

type UpdateParams = BitbucketPullRequestTarget & {
  readonly title?: string;
  readonly description?: string;
  readonly reviewerUuids?: ReadonlyArray<string>;
};

export const bitbucketUpdatePullRequest = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
  title,
  description,
  reviewerUuids,
}: UpdateParams): Promise<BitbucketPullRequest> =>
  invokeCommand<BitbucketPullRequest>('bitbucket_update_pull_request', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
    title: title ?? null,
    description: description ?? null,
    reviewerUuids: reviewerUuids ?? null,
  });

type SearchMembersParams = Omit<BitbucketRepo, 'repoSlug'> & {
  readonly query: string;
};

export const bitbucketSearchWorkspaceMembers = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  email,
  query,
}: SearchMembersParams): Promise<ReadonlyArray<BitbucketUser>> =>
  invokeCommand<ReadonlyArray<BitbucketUser>>('bitbucket_search_workspace_members', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    email,
    query,
  });

export type BitbucketCommit = {
  readonly hash: string;
  readonly message: string;
  readonly date: string;
  readonly author: string | null;
};

export const bitbucketListPullRequestCommits = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<ReadonlyArray<BitbucketCommit>> =>
  invokeCommand<ReadonlyArray<BitbucketCommit>>('bitbucket_list_pull_request_commits', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });

export const bitbucketDeclinePullRequest = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
}: BitbucketPullRequestTarget): Promise<BitbucketPullRequest> =>
  invokeCommand<BitbucketPullRequest>('bitbucket_decline_pull_request', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
  });

type CreateCommentParams = BitbucketPullRequestTarget & {
  readonly body: string;
};

export const bitbucketCreatePullRequestComment = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
  body,
}: CreateCommentParams): Promise<BitbucketComment> =>
  invokeCommand<BitbucketComment>('bitbucket_create_pull_request_comment', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
    body,
  });

type ReplyParams = CreateCommentParams & {
  readonly parentCommentId: number;
};

export const bitbucketReplyToPullRequestComment = async ({
  workspaceId,
  projectId,
  workspaceSlug,
  repoSlug,
  email,
  pullRequestId,
  parentCommentId,
  body,
}: ReplyParams): Promise<BitbucketComment> =>
  invokeCommand<BitbucketComment>('bitbucket_reply_to_pull_request_comment', {
    workspaceId,
    ...(projectId != null ? { projectId } : {}),
    workspaceSlug,
    repoSlug,
    email,
    pullRequestId,
    parentCommentId,
    body,
  });
