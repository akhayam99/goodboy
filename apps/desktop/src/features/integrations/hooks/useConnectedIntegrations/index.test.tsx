// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

vi.mock('../../../../store', async () => {
  const { create } = await import('zustand');
  type MockState = {
    readonly workspaceIntegrations: Readonly<Record<string, ReadonlyArray<{ provider: string }>>>;
    readonly unrelated: number;
  };
  const useAppStore = create<MockState>(() => ({ workspaceIntegrations: {}, unrelated: 0 }));
  return { useAppStore };
});

vi.mock('../../github/useGithubConnection', () => ({
  useGithubConnection: () => ({ isAuthenticated: true }),
}));

import { useAppStore } from '../../../../store';
import { useConnectedIntegrations } from './index';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

afterEach(cleanup);

describe('useConnectedIntegrations', () => {
  it('reads every glyph provider for the workspace, github from its connection', () => {
    useAppStore.setState({
      workspaceIntegrations: { [WORKSPACE_ID]: [{ provider: 'linear' }, { provider: 'slack' }] },
    } as never);

    const { result } = renderHook(() => useConnectedIntegrations({ workspaceId: WORKSPACE_ID }));

    expect(result.current).toEqual({
      github: true,
      gitlab: false,
      bitbucket: false,
      linear: true,
      jira: false,
      sentry: false,
      slack: true,
    });
  });

  it('keeps the same record across unrelated store writes', () => {
    const { result } = renderHook(() => useConnectedIntegrations({ workspaceId: WORKSPACE_ID }));
    const first = result.current;

    act(() => useAppStore.setState({ unrelated: 1 } as never));

    expect(result.current).toBe(first);
  });
});
