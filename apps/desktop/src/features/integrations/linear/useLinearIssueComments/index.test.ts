// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { overridesWithAttribution } from '../../../../__tests__/helpers/attributionOverrides';
import { useAppStore } from '../../../../store';
import { useLinearIssueComments } from '.';

const fetchComments = vi.hoisted(() => vi.fn());
const createComment = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  linearFetchIssueComments: fetchComments,
  linearCreateComment: createComment,
}));

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const comment = ({
  id,
  body,
  parentId = null,
}: {
  id: string;
  body: string;
  parentId?: string | null;
}) => ({
  id,
  body,
  createdAt: '2026-07-23T10:00:00Z',
  parent: parentId == null ? null : { id: parentId },
  user: { name: 'Ada', avatarUrl: null },
});

afterEach(() => {
  cleanup();
  fetchComments.mockReset();
  createComment.mockReset();
  useAppStore.setState({ workspaceOverrides: {} });
});

describe('useLinearIssueComments', () => {
  it('loads comments when the selected issue changes', async () => {
    fetchComments
      .mockResolvedValueOnce([comment({ id: 'comment-1', body: 'First comment' })])
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
    fetchComments.mockResolvedValue([comment({ id: 'comment-1', body: 'First comment' })]);
    createComment.mockResolvedValue(comment({ id: 'comment-2', body: 'Looks good' }));
    const { result } = renderHook(() =>
      useLinearIssueComments({ workspaceId: WORKSPACE_ID, issueId: 'issue-1' }),
    );

    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await act(async () => {
      await result.current.post?.({ body: 'Looks good', parentId: null });
    });

    expect(createComment).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      issueId: 'issue-1',
      body: `Looks good\n\n*Written by Goodboy*`,
      parentId: null,
      projectId: undefined,
    });
    expect(result.current.comments.map((entry) => entry.id)).toEqual(['comment-1', 'comment-2']);
  });

  it('posts a reply under the parent comment', async () => {
    fetchComments.mockResolvedValue([comment({ id: 'comment-1', body: 'First comment' })]);
    createComment.mockResolvedValue(
      comment({ id: 'comment-2', body: 'Agreed', parentId: 'comment-1' }),
    );
    const { result } = renderHook(() =>
      useLinearIssueComments({ workspaceId: WORKSPACE_ID, issueId: 'issue-1' }),
    );

    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await act(async () => {
      await result.current.post?.({ body: 'Agreed', parentId: 'comment-1' });
    });

    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({ issueId: 'issue-1', parentId: 'comment-1' }),
    );
    expect(result.current.comments[1]?.parent).toEqual({ id: 'comment-1' });
  });

  it('drops the attribution line when the workspace switched it off', async () => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE_ID]: overridesWithAttribution({ attributionFooter: false }),
      },
    });
    fetchComments.mockResolvedValue([]);
    createComment.mockResolvedValue(comment({ id: 'comment-2', body: 'Looks good' }));
    const { result } = renderHook(() =>
      useLinearIssueComments({ workspaceId: WORKSPACE_ID, issueId: 'issue-1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.post?.({ body: 'Looks good', parentId: null });
    });

    expect(createComment).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      issueId: 'issue-1',
      body: 'Looks good',
      parentId: null,
      projectId: undefined,
    });
  });

  it('offers no post callback while there is no issue selected', () => {
    const { result } = renderHook(() =>
      useLinearIssueComments({ workspaceId: WORKSPACE_ID, issueId: null }),
    );

    expect(result.current.post).toBeNull();
  });
});
