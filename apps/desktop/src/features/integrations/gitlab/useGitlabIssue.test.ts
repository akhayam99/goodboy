import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { gitlabFetchIssue, type GitlabIssue } from './client';
import { useGitlabIssue } from './useGitlabIssue';

type StoreGitlabIntegration = { provider: string; config: { host: string } };

const h = vi.hoisted(() => ({
  store: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<StoreGitlabIntegration>>,
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

vi.mock('./client', () => ({
  gitlabFetchIssue: vi.fn(),
}));

const fetchIssue = vi.mocked(gitlabFetchIssue);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const ISSUE: GitlabIssue = {
  id: 101,
  iid: 7,
  projectId: 3,
  title: 'Fix the thing',
  description: 'Details',
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/issues/7',
  references: { full: 'acme/web#7' },
  updatedAt: '2026-05-21T10:00:00Z',
  milestone: null,
  labels: [],
};

beforeEach(() => {
  fetchIssue.mockReset();
  h.store.workspaceIntegrations = {
    [WORKSPACE_ID]: [{ provider: 'gitlab', config: { host: 'https://gitlab.com' } }],
  };
});

afterEach(cleanup);

describe('useGitlabIssue', () => {
  it('parses the project path and iid out of the identifier', async () => {
    fetchIssue.mockResolvedValueOnce(ISSUE);

    const { result } = renderHook(() =>
      useGitlabIssue({ workspaceId: WORKSPACE_ID, identifier: 'acme/web#7' }),
    );

    await waitFor(() => expect(result.current.issue).toEqual(ISSUE));
    expect(fetchIssue).toHaveBeenCalledWith(
      WORKSPACE_ID,
      'https://gitlab.com',
      'acme/web',
      7,
      undefined,
    );
  });

  it('surfaces the fetch error and recovers on retry', async () => {
    fetchIssue.mockRejectedValueOnce(new Error('request failed'));

    const { result } = renderHook(() =>
      useGitlabIssue({ workspaceId: WORKSPACE_ID, identifier: 'acme/web#7' }),
    );

    await waitFor(() => expect(result.current.error).toBe('request failed'));
    expect(result.current.issue).toBeNull();

    fetchIssue.mockResolvedValueOnce(ISSUE);
    result.current.refetch();

    await waitFor(() => expect(result.current.issue).toEqual(ISSUE));
    expect(result.current.error).toBeNull();
  });

  it('errors instead of fetching when the identifier has no project path', async () => {
    const { result } = renderHook(() =>
      useGitlabIssue({ workspaceId: WORKSPACE_ID, identifier: '#7' }),
    );

    await waitFor(() =>
      expect(result.current.error).toBe('Could not resolve the GitLab project for this issue.'),
    );
    expect(fetchIssue).not.toHaveBeenCalled();
  });
});
