import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  listComments: vi.fn(async (target: { readonly pullRequestId: number }) => {
    if (target.pullRequestId !== 42) {
      return new Promise<ReadonlyArray<unknown>>(() => undefined);
    }
    return [
      {
        id: 5,
        body: 'one nit',
        user: null,
        createdOn: '2026-08-01T10:00:00Z',
        updatedOn: '2026-08-01T10:00:00Z',
        deleted: false,
        parentId: null,
        inline: null,
        webUrl: null,
      },
    ];
  }),
  listStatuses: vi.fn(async () => []),
}));

vi.mock('../../client', () => ({
  bitbucketListPullRequestComments: h.listComments,
  bitbucketListPullRequestStatuses: h.listStatuses,
}));

const { useBitbucketPrDetail } = await import('./useBitbucketPrDetail');

const target = (pullRequestId: number) => ({
  workspaceId: 'ws-1' as WorkspaceId,
  workspaceSlug: 'acme',
  repoSlug: 'rocket',
  email: 'dev@acme.test',
  pullRequestId,
});

describe('useBitbucketPrDetail', () => {
  afterEach(cleanup);

  it('reports loading while the first request for a pull request is in flight', () => {
    const { result } = renderHook(() => useBitbucketPrDetail({ target: target(43) }));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.comments).toEqual([]);
  });

  it('drops the comments of the pull request it was showing the moment the target changes', async () => {
    const { result, rerender } = renderHook(
      ({ pullRequestId }: { readonly pullRequestId: number }) =>
        useBitbucketPrDetail({ target: target(pullRequestId) }),
      { initialProps: { pullRequestId: 42 } },
    );
    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    rerender({ pullRequestId: 43 });

    expect(result.current.comments).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });
});
