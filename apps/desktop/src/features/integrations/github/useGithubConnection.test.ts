import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GhTokenStatus, WorkspaceId } from '@goodboy/types';
import { ghStatus } from '../../github/github';
import { useGithubConnection } from './useGithubConnection';

vi.mock('../../github/github', () => ({
  ghStatus: vi.fn(),
}));

const fetchStatus = vi.mocked(ghStatus);
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

beforeEach(() => {
  fetchStatus.mockReset();
});

afterEach(cleanup);

describe('useGithubConnection', () => {
  it('is not scoped when auth falls back to the system gh CLI with no workspace token', async () => {
    const status: GhTokenStatus = { mode: 'gh-cli', available: true, scoped: false };
    fetchStatus.mockResolvedValueOnce(status);

    const { result } = renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.isScoped).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('is scoped when a workspace-specific personal access token is set', async () => {
    const status: GhTokenStatus = { mode: 'pat', available: true, scoped: true };
    fetchStatus.mockResolvedValueOnce(status);

    const { result } = renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.isScoped).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('is not scoped while the status has not resolved yet', () => {
    fetchStatus.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));

    expect(result.current.isResolved).toBe(false);
    expect(result.current.isScoped).toBe(false);
  });

  it('is not scoped when the status check fails', async () => {
    fetchStatus.mockRejectedValueOnce(new Error('gh status check failed'));

    const { result } = renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.isScoped).toBe(false);
  });
});
