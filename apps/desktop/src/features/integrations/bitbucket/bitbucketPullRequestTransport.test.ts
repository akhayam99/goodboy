// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { PullRequestPortError, STALE_HEAD_MESSAGE, isPullRequestPortError } from '@goodboy/core';
import type { WorkspaceId } from '@goodboy/types';
import { bitbucketPullRequestTransport } from './bitbucketPullRequestTransport';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const mockInvoke = vi.mocked(invoke);

afterEach(() => {
  mockInvoke.mockReset();
});

const repo = {
  workspaceId: 'w1' as WorkspaceId,
  workspaceSlug: 'harborline',
  repoSlug: 'payments-api',
  email: 'nadia@harborline.test',
};

const target = { ...repo, pullRequestId: 42 };

describe('bitbucketPullRequestTransport', () => {
  it('reads through the four read commands with the same target', async () => {
    mockInvoke.mockResolvedValue([]);
    const transport = bitbucketPullRequestTransport({ repo, pullRequestId: 42 });

    await transport.readPullRequest();
    await transport.readStatuses();
    await transport.readCommits();
    await transport.readDiff();

    expect(mockInvoke.mock.calls).toEqual([
      ['bitbucket_get_pull_request', target],
      ['bitbucket_list_pull_request_statuses', target],
      ['bitbucket_list_pull_request_commits', target],
      ['bitbucket_pull_request_diff', target],
    ]);
  });

  it('sends only the supplied update fields', async () => {
    mockInvoke.mockResolvedValue({});
    const transport = bitbucketPullRequestTransport({ repo, pullRequestId: 42 });

    await transport.updatePullRequest({ description: 'Why' });

    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_update_pull_request', {
      ...target,
      title: null,
      description: 'Why',
      reviewerUuids: null,
    });
  });

  it('merges with the named strategy and declines on close', async () => {
    mockInvoke.mockResolvedValue({});
    const transport = bitbucketPullRequestTransport({ repo, pullRequestId: 42 });

    await transport.merge({ strategy: 'rebase_merge', expectedHeadSha: null });
    await transport.decline();

    expect(mockInvoke.mock.calls.map((call) => call[0])).toEqual([
      'bitbucket_merge_pull_request',
      'bitbucket_decline_pull_request',
    ]);
    expect(mockInvoke.mock.calls[0]?.[1]).toMatchObject({ mergeStrategy: 'rebase_merge' });
  });

  it('hands the reviewed head to the merge command', async () => {
    mockInvoke.mockResolvedValue({});
    const transport = bitbucketPullRequestTransport({ repo, pullRequestId: 42 });

    await transport.merge({ strategy: 'squash', expectedHeadSha: '6c20f48a9e1d' });

    expect(mockInvoke.mock.calls[0]?.[1]).toMatchObject({ expectedHeadSha: '6c20f48a9e1d' });
  });

  it('names a moved head as stale_head with the refresh and review message', async () => {
    mockInvoke.mockRejectedValue({
      kind: 'stale_head',
      message: 'the branch changed after it was reviewed: reviewed 6c20f48a9e1d, now 9f3e2d1c0b8a',
    });
    const transport = bitbucketPullRequestTransport({ repo, pullRequestId: 42 });

    const error = await transport
      .merge({ strategy: 'squash', expectedHeadSha: '6c20f48a9e1d' })
      .then(
        () => null,
        (caught: unknown) => (isPullRequestPortError(caught) ? caught : null),
      );

    expect(error?.kind).toBe('stale_head');
    expect(error?.message).toBe(STALE_HEAD_MESSAGE);
    expect(error?.details).toContain('9f3e2d1c0b8a');
  });

  it('searches members of the workspace without the repository', async () => {
    mockInvoke.mockResolvedValue([]);
    const transport = bitbucketPullRequestTransport({ repo, pullRequestId: 42 });

    await transport.searchMembers({ query: 'ken' });

    expect(mockInvoke).toHaveBeenCalledWith('bitbucket_search_workspace_members', {
      workspaceId: repo.workspaceId,
      workspaceSlug: repo.workspaceSlug,
      email: repo.email,
      query: 'ken',
    });
  });

  it('turns a rejected command into a typed port error with the host text', async () => {
    mockInvoke.mockRejectedValue({
      kind: 'http',
      message: 'http error 400: {"error":{"message":"Squash is not allowed"}}',
      failureKind: 'failed',
      status: 400,
      detail: '{"error":{"message":"Squash is not allowed"}}',
    });
    const transport = bitbucketPullRequestTransport({ repo, pullRequestId: 42 });

    const error = await transport.merge({ strategy: 'squash', expectedHeadSha: null }).then(
      () => null,
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(PullRequestPortError);
    expect((error as PullRequestPortError).kind).toBe('failed');
    expect((error as PullRequestPortError).message).toBe('Squash is not allowed');
  });
});
