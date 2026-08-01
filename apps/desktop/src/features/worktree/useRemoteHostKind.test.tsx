// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Session, SessionId, SessionMount, WorkspaceId } from '@goodboy/types';

const { worktreeRemoteUrl } = vi.hoisted(() => ({
  worktreeRemoteUrl: vi.fn(),
}));

vi.mock('./worktree', () => ({ worktreeRemoteUrl }));

import { useAppStore } from '../../store';
import { useRemoteHostKind } from './useRemoteHostKind';

const SESSION_ID = 'remote-host-session' as SessionId;
const COMPOSITE_WORKSPACE_ID = 'remote-host-composite' as WorkspaceId;
const API_WORKSPACE_ID = 'remote-host-api' as WorkspaceId;
const WEB_WORKSPACE_ID = 'remote-host-web' as WorkspaceId;
const NOW = '2026-08-01T00:00:00.000Z' as IsoDateTime;

const SESSION = {
  id: SESSION_ID,
  workspaceId: COMPOSITE_WORKSPACE_ID,
  goal: 'Resolve the active remote',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
} satisfies Session;

const API_MOUNT = {
  workspaceId: API_WORKSPACE_ID,
  mountName: 'api',
  worktreePath: '/remote-host/worktrees/api',
  repoRoot: '/remote-host/repos/api',
  branch: 'ak/active-remote',
} satisfies SessionMount;

const WEB_MOUNT = {
  workspaceId: WEB_WORKSPACE_ID,
  mountName: 'web',
  worktreePath: '/remote-host/worktrees/web',
  repoRoot: '/remote-host/repos/web',
  branch: 'ak/active-remote',
} satisfies SessionMount;

beforeEach(() => {
  worktreeRemoteUrl.mockReset();
  worktreeRemoteUrl.mockImplementation(async (repoRoot: string) =>
    repoRoot === API_MOUNT.repoRoot
      ? 'git@github.com:goodboy/api.git'
      : 'git@gitlab.com:goodboy/web.git',
  );
  useAppStore.setState({
    sessions: [SESSION],
    workspaces: [
      {
        id: COMPOSITE_WORKSPACE_ID,
        name: 'Composite',
        rootPath: '/remote-host/composite',
        kind: 'composite',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    sessionMounts: { [SESSION_ID]: [API_MOUNT, WEB_MOUNT] },
    sessionActiveMount: { [SESSION_ID]: API_WORKSPACE_ID },
    sessionWorktrees: { [SESSION_ID]: ['/remote-host/container'] },
    sessionBranches: {},
    workspaceIntegrations: {},
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState({
    sessions: [],
    workspaces: [],
    sessionMounts: {},
    sessionActiveMount: {},
    sessionWorktrees: {},
    sessionBranches: {},
    workspaceIntegrations: {},
  });
});

describe('useRemoteHostKind', () => {
  it('resolves and caches the remote by the active mount repo root', async () => {
    const { result } = renderHook(() => useRemoteHostKind({ sessionId: SESSION_ID }));

    await waitFor(() => expect(result.current).toBe('github'));
    act(() => {
      useAppStore.getState().setSessionActiveMount({
        sessionId: SESSION_ID,
        workspaceId: WEB_WORKSPACE_ID,
      });
    });
    await waitFor(() => expect(result.current).toBe('gitlab'));
    expect(worktreeRemoteUrl).toHaveBeenNthCalledWith(1, API_MOUNT.repoRoot);
    expect(worktreeRemoteUrl).toHaveBeenNthCalledWith(2, WEB_MOUNT.repoRoot);
  });
});
