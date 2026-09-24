import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const h = vi.hoisted(() => ({ ghStatus: vi.fn() }));

vi.mock('../../github/github', () => ({ ghStatus: h.ghStatus }));

import { useAppStore } from '../../../store';
import { useGithubConnection } from './useGithubConnection';

beforeEach(() => {
  h.ghStatus.mockReset();
  h.ghStatus.mockResolvedValue({ available: true, mode: 'absent' });
  useAppStore.setState({ githubWorkspaceStatus: {} });
});

afterEach(cleanup);

describe('useGithubConnection', () => {
  it('re-reads every mounted instance when one of them refreshes', async () => {
    const first = renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));
    const second = renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));

    await waitFor(() => expect(first.result.current.isResolved).toBe(true));
    await waitFor(() => expect(second.result.current.isResolved).toBe(true));
    expect(first.result.current.isAuthenticated).toBe(false);
    expect(second.result.current.isAuthenticated).toBe(false);

    h.ghStatus.mockResolvedValue({ available: true, mode: 'pat', user: 'harborline-bot' });
    await act(async () => {
      first.result.current.refresh();
    });

    await waitFor(() => expect(second.result.current.isAuthenticated).toBe(true));
    expect(first.result.current.isAuthenticated).toBe(true);
  });

  it('reads the status once for instances mounted on the same workspace', async () => {
    const first = renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));
    await waitFor(() => expect(first.result.current.isResolved).toBe(true));
    renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));

    expect(h.ghStatus).toHaveBeenCalledTimes(1);
  });

  it('follows a store write without a refresh', async () => {
    const view = renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));
    await waitFor(() => expect(view.result.current.isResolved).toBe(true));

    act(() => {
      useAppStore.setState({
        githubWorkspaceStatus: {
          [WORKSPACE_ID]: { available: true, mode: 'pat', scopes: ['repo'], scoped: true },
        },
      });
    });

    expect(view.result.current.isScoped).toBe(true);
  });
});
