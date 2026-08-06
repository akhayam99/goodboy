import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const h = vi.hoisted(() => ({ ghStatus: vi.fn() }));

vi.mock('../../github/github', () => ({ ghStatus: h.ghStatus }));

import { useGithubConnection } from './useGithubConnection';

beforeEach(() => {
  h.ghStatus.mockReset();
  h.ghStatus.mockResolvedValue({ available: true, mode: 'absent' });
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

    h.ghStatus.mockResolvedValue({ available: true, mode: 'connected', user: 'nbro' });
    await act(async () => {
      first.result.current.refresh();
    });

    await waitFor(() => expect(second.result.current.isAuthenticated).toBe(true));
    expect(first.result.current.isAuthenticated).toBe(true);
  });

  it('stops listening once an instance unmounts', async () => {
    const view = renderHook(() => useGithubConnection({ workspaceId: WORKSPACE_ID }));
    await waitFor(() => expect(view.result.current.isResolved).toBe(true));

    view.unmount();
    h.ghStatus.mockClear();
    await act(async () => {
      window.dispatchEvent(new CustomEvent('goodboy:github-connection-changed'));
    });

    expect(h.ghStatus).not.toHaveBeenCalled();
  });
});
