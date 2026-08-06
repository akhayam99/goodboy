// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { useLinearIssueComments } from './useLinearIssueComments';

const fetchComments = vi.hoisted(() => vi.fn());
const createComment = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  linearFetchIssueComments: fetchComments,
  linearCreateComment: createComment,
}));

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

afterEach(() => {
  cleanup();
  fetchComments.mockReset();
  createComment.mockReset();
});

describe('useLinearIssueComments', () => {
  it('loads comments when the selected issue changes', async () => {
    fetchComments
      .mockResolvedValueOnce([
        {
          id: 'comment-1',
          body: 'First comment',
          createdAt: '2026-07-23T10:00:00Z',
          user: { name: 'Ada' },
        },
      ])
      .mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(
      ({ issueId }: { issueId: string | null }) =>
        useLinearIssueComments({ workspaceId: WORKSPACE_ID, issueId }),
      { initialProps: { issueId: 'issue-1' } },
    );

    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    rerender({ issueId: 'issue-2' });
    await waitFor(() => expect(fetchComments).toHaveBeenCalledTimes(2));

    expect(fetchComments.mock.calls).toEqual([
      [{ workspaceId: WORKSPACE_ID, issueId: 'issue-1' }],
      [{ workspaceId: WORKSPACE_ID, issueId: 'issue-2' }],
    ]);
  });

  it('appends the comment Linear returns so the list carries the new post', async () => {
    fetchComments.mockResolvedValue([
      {
        id: 'comment-1',
        body: 'First comment',
        createdAt: '2026-07-23T10:00:00Z',
        user: { name: 'Ada' },
      },
    ]);
    createComment.mockResolvedValue({
      id: 'comment-2',
      body: 'Looks good',
      createdAt: '2026-07-24T10:00:00Z',
      user: { name: 'Grace' },
    });
    const { result } = renderHook(() =>
      useLinearIssueComments({ workspaceId: WORKSPACE_ID, issueId: 'issue-1' }),
    );

    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await act(async () => {
      await result.current.post?.('Looks good');
    });

    expect(createComment).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      issueId: 'issue-1',
      body: 'Looks good',
    });
    expect(result.current.comments.map((comment) => comment.id)).toEqual([
      'comment-1',
      'comment-2',
    ]);
  });

  it('offers no post callback while there is no issue selected', () => {
    const { result } = renderHook(() =>
      useLinearIssueComments({ workspaceId: WORKSPACE_ID, issueId: null }),
    );

    expect(result.current.post).toBeNull();
  });
});
