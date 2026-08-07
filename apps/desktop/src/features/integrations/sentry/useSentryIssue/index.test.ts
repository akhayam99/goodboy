import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { sentryFetchIssue, type SentryIssue } from '../client';
import { useSentryIssue } from '.';

vi.mock('../client', () => ({
  sentryFetchIssue: vi.fn(),
}));

const fetchIssue = vi.mocked(sentryFetchIssue);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const ISSUE: SentryIssue = {
  id: '42',
  shortId: 'GOODBOY-42',
  title: 'TypeError: request failed',
  culprit: 'api/items',
  level: 'error',
  status: 'unresolved',
  count: '128',
  userCount: 9,
  firstSeen: '2026-07-01T09:00:00Z',
  lastSeen: '2026-07-23T10:00:00Z',
  permalink: 'https://sentry.io/issues/42',
  metadata: null,
};

beforeEach(() => {
  fetchIssue.mockReset();
});

afterEach(cleanup);

describe('useSentryIssue', () => {
  it('fetches the issue by id', async () => {
    fetchIssue.mockResolvedValueOnce(ISSUE);

    const { result } = renderHook(() =>
      useSentryIssue({ workspaceId: WORKSPACE_ID, issueId: '42' }),
    );

    await waitFor(() => expect(result.current.issue).toEqual(ISSUE));
    expect(fetchIssue).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID, issueId: '42' });
  });

  it('surfaces the fetch error and recovers on retry', async () => {
    fetchIssue.mockRejectedValueOnce(new Error('invalid response shape: missing field `title`'));

    const { result } = renderHook(() =>
      useSentryIssue({ workspaceId: WORKSPACE_ID, issueId: '42' }),
    );

    await waitFor(() =>
      expect(result.current.error).toBe('invalid response shape: missing field `title`'),
    );
    expect(result.current.issue).toBeNull();

    fetchIssue.mockResolvedValueOnce(ISSUE);
    result.current.refetch();

    await waitFor(() => expect(result.current.issue).toEqual(ISSUE));
    expect(result.current.error).toBeNull();
  });

  it('does not fetch without an issue id', async () => {
    const { result } = renderHook(() =>
      useSentryIssue({ workspaceId: WORKSPACE_ID, issueId: null }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchIssue).not.toHaveBeenCalled();
  });
});
