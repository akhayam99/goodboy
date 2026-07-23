import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { sentryFetchIssueDetail } from './client';
import { useSentryIssueDetail } from './useSentryIssueDetail';

vi.mock('./client', () => ({
  sentryFetchIssueDetail: vi.fn(),
}));

const fetchIssueDetail = vi.mocked(sentryFetchIssueDetail);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const DETAIL = {
  title: 'First issue',
  culprit: 'handleRequest',
  frames: [
    {
      filename: 'src/first.ts',
      function: 'handleRequest',
      line_no: 42,
      in_app: true,
    },
  ],
};

beforeEach(() => {
  fetchIssueDetail.mockReset();
});

afterEach(cleanup);

describe('useSentryIssueDetail', () => {
  it('returns the issue id associated with the fetched detail', async () => {
    fetchIssueDetail.mockResolvedValueOnce(DETAIL);
    const { result } = renderHook(() =>
      useSentryIssueDetail({ workspaceId: WORKSPACE_ID, issueId: 'issue-1' }),
    );

    await waitFor(() => expect(result.current.detail?.issueId).toBe('issue-1'));
    expect(result.current.detail).toMatchObject(DETAIL);
  });

  it('clears previous detail when the next issue fetch fails', async () => {
    fetchIssueDetail.mockResolvedValueOnce(DETAIL);
    const { result, rerender } = renderHook(
      ({ issueId }: { issueId: string }) =>
        useSentryIssueDetail({ workspaceId: WORKSPACE_ID, issueId }),
      { initialProps: { issueId: 'issue-1' } },
    );
    await waitFor(() => expect(result.current.detail?.issueId).toBe('issue-1'));

    fetchIssueDetail.mockRejectedValueOnce(new Error('request failed'));
    rerender({ issueId: 'issue-2' });

    await waitFor(() => expect(result.current.error).toBe('request failed'));
    expect(result.current.detail).toBeNull();
  });
});
