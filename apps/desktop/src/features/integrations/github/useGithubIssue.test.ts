import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubIssue, WorkspaceId } from '@goodboy/types';
import { ghIssueByNumber } from './github';
import { useGithubIssue } from './useGithubIssue';

vi.mock('./github', () => ({
  ghIssueByNumber: vi.fn(),
}));

const fetchIssue = vi.mocked(ghIssueByNumber);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const ISSUE: GithubIssue = {
  number: 42,
  title: 'Fix the thing',
  body: 'Details',
  url: 'https://github.com/acme/web/issues/42',
  state: 'OPEN',
  labels: ['bug'],
  updatedAt: '2026-05-21T10:00:00Z',
};

beforeEach(() => {
  fetchIssue.mockReset();
});

afterEach(cleanup);

describe('useGithubIssue', () => {
  it('loads the issue for the given repo root', async () => {
    fetchIssue.mockResolvedValueOnce(ISSUE);

    const { result } = renderHook(() =>
      useGithubIssue({ workspaceId: WORKSPACE_ID, rootPath: '/repo', issueNumber: 42 }),
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.issue).toEqual(ISSUE));
    expect(result.current.error).toBeNull();
    expect(fetchIssue).toHaveBeenCalledWith('/repo', 42, WORKSPACE_ID);
  });

  it('surfaces the fetch error and clears it again on retry', async () => {
    fetchIssue.mockRejectedValueOnce(new Error('gh issue view failed'));

    const { result } = renderHook(() =>
      useGithubIssue({ workspaceId: WORKSPACE_ID, rootPath: '/repo', issueNumber: 42 }),
    );

    await waitFor(() => expect(result.current.error).toBe('gh issue view failed'));
    expect(result.current.issue).toBeNull();

    fetchIssue.mockResolvedValueOnce(ISSUE);
    result.current.refetch();

    await waitFor(() => expect(result.current.issue).toEqual(ISSUE));
    expect(result.current.error).toBeNull();
  });

  it('skips fetching without a resolved repo root', () => {
    const { result } = renderHook(() =>
      useGithubIssue({ workspaceId: WORKSPACE_ID, rootPath: null, issueNumber: 42 }),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.issue).toBeNull();
    expect(fetchIssue).not.toHaveBeenCalled();
  });
});
