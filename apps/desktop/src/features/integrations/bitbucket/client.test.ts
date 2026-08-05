import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceId } from '@goodboy/types';
import {
  bitbucketApprovePullRequest,
  bitbucketConnect,
  bitbucketCreatePullRequestComment,
  bitbucketDeclinePullRequest,
  bitbucketDisconnect,
  bitbucketGetPullRequest,
  bitbucketListPullRequestComments,
  bitbucketListPullRequestStatuses,
  bitbucketListPullRequests,
  bitbucketMergePullRequest,
  bitbucketPullRequestDiff,
  bitbucketPullRequestForBranch,
  bitbucketReplyToPullRequestComment,
  bitbucketRequestChanges,
  bitbucketUnapprovePullRequest,
  bitbucketUnrequestChanges,
  bitbucketValidateConnection,
} from './client';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const mockInvoke = vi.mocked(invoke);

afterEach(() => {
  mockInvoke.mockReset();
});

const repo = {
  workspaceId: 'w1' as WorkspaceId,
  workspaceSlug: 'goodboy',
  repoSlug: 'desktop',
  email: 'amin@acme.io',
};

const target = { ...repo, pullRequestId: 42 };

describe('bitbucket client', () => {
  it('validates a connection without the goodboy workspace id', async () => {
    mockInvoke.mockResolvedValue({ user: {}, workspace: {} });

    await bitbucketValidateConnection({
      workspaceSlug: 'goodboy',
      email: 'amin@acme.io',
      apiToken: 'tok',
    });

    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_validate_connection', {
      workspaceSlug: 'goodboy',
      email: 'amin@acme.io',
      apiToken: 'tok',
    });
  });

  it('stores and clears the token through the two lifecycle commands', async () => {
    await bitbucketConnect({ workspaceId: 'w1' as WorkspaceId, apiToken: 'tok' });
    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_connect', {
      workspaceId: 'w1',
      apiToken: 'tok',
    });

    await bitbucketDisconnect({ workspaceId: 'w1' as WorkspaceId });
    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_disconnect', { workspaceId: 'w1' });
  });

  it('sends a null state when the caller does not filter the pull request list', async () => {
    mockInvoke.mockResolvedValue([]);

    await bitbucketListPullRequests(repo);

    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_list_pull_requests', {
      ...repo,
      state: null,
    });
  });

  it('forwards the pull request id to every single pull request read', async () => {
    mockInvoke.mockResolvedValue({});

    await bitbucketGetPullRequest(target);
    await bitbucketPullRequestDiff(target);
    await bitbucketListPullRequestComments(target);
    await bitbucketListPullRequestStatuses(target);

    expect(mockInvoke.mock.calls.map((call) => call[0])).toEqual([
      'bitbucket_get_pull_request',
      'bitbucket_pull_request_diff',
      'bitbucket_list_pull_request_comments',
      'bitbucket_list_pull_request_statuses',
    ]);
    expect(mockInvoke).toHaveBeenLastCalledWith('bitbucket_list_pull_request_statuses', target);
  });

  it('resolves a branch to its open pull request', async () => {
    mockInvoke.mockResolvedValue(null);

    await bitbucketPullRequestForBranch({ ...repo, sourceBranch: 'ak/feat-bb' });

    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_pull_request_for_branch', {
      ...repo,
      sourceBranch: 'ak/feat-bb',
    });
  });

  it('maps each review verb to its own command', async () => {
    mockInvoke.mockResolvedValue({});

    await bitbucketApprovePullRequest(target);
    await bitbucketUnapprovePullRequest(target);
    await bitbucketRequestChanges(target);
    await bitbucketUnrequestChanges(target);
    await bitbucketDeclinePullRequest(target);

    expect(mockInvoke.mock.calls.map((call) => call[0])).toEqual([
      'bitbucket_approve_pull_request',
      'bitbucket_unapprove_pull_request',
      'bitbucket_request_changes',
      'bitbucket_unrequest_changes',
      'bitbucket_decline_pull_request',
    ]);
  });

  it('sends null merge options rather than omitting them', async () => {
    mockInvoke.mockResolvedValue({});

    await bitbucketMergePullRequest(target);

    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_merge_pull_request', {
      ...target,
      closeSourceBranch: null,
      message: null,
    });
  });

  it('carries the merge options the caller did give', async () => {
    mockInvoke.mockResolvedValue({});

    await bitbucketMergePullRequest({ ...target, closeSourceBranch: true, message: 'ship it' });

    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_merge_pull_request', {
      ...target,
      closeSourceBranch: true,
      message: 'ship it',
    });
  });

  it('separates a new comment from a reply by the parent comment id', async () => {
    mockInvoke.mockResolvedValue({});

    await bitbucketCreatePullRequestComment({ ...target, body: 'lgtm' });
    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_create_pull_request_comment', {
      ...target,
      body: 'lgtm',
    });

    await bitbucketReplyToPullRequestComment({ ...target, parentCommentId: 90, body: 'agreed' });
    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_reply_to_pull_request_comment', {
      ...target,
      parentCommentId: 90,
      body: 'agreed',
    });
  });
});
