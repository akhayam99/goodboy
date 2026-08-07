import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { linearFetchIssue, type LinearIssue } from './client';
import { useLinearIssue } from './useLinearIssue';

vi.mock('./client', () => ({
  linearFetchIssue: vi.fn(),
}));

const fetchIssue = vi.mocked(linearFetchIssue);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const ISSUE_ID = 'issue-7';

const ISSUE: LinearIssue = {
  id: ISSUE_ID,
  identifier: 'ACME-7',
  title: 'Fix the thing',
  description: 'Details',
  url: 'https://linear.app/acme/issue/ACME-7',
  state: { name: 'Todo', type: 'unstarted' },
  team: { key: 'ACME' },
  updatedAt: '2026-05-21T10:00:00Z',
};

beforeEach(() => {
  fetchIssue.mockReset();
});

afterEach(cleanup);

describe('useLinearIssue', () => {
  it('surfaces the fetch error and recovers on retry', async () => {
    fetchIssue.mockRejectedValueOnce(new Error('request failed'));

    const { result } = renderHook(() =>
      useLinearIssue({ workspaceId: WORKSPACE_ID, issueId: ISSUE_ID }),
    );

    await waitFor(() => expect(result.current.error).toBe('request failed'));
    expect(result.current.issue).toBeNull();
    expect(fetchIssue).toHaveBeenCalledTimes(1);

    fetchIssue.mockResolvedValueOnce(ISSUE);
    result.current.refetch();

    await waitFor(() => expect(result.current.issue).toEqual(ISSUE));
    expect(result.current.error).toBeNull();
    expect(fetchIssue).toHaveBeenCalledTimes(2);
  });
});
