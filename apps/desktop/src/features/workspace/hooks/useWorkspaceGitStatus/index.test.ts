// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Workspace, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  store: {
    workspaces: [] as ReadonlyArray<Workspace>,
    workspaceGitStatus: {} as Record<string, WorkspaceGitStatus | undefined>,
    loadWorkspaceGitStatus: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

import { useWorkspaceGitStatus } from './index';

const WS_ID = 'ws-1' as WorkspaceId;

const ready: WorkspaceGitStatus = {
  state: 'ready',
  branch: 'main',
  headSubject: 'base',
  ahead: 0,
  behind: 0,
  staged: 0,
  unstaged: 0,
  untracked: 0,
  changed: 0,
  hasUpstream: true,
};

const workspace = (kind: Workspace['kind']): Workspace =>
  ({ id: WS_ID, name: 'ws', rootPath: '/repo', kind }) as Workspace;

beforeEach(() => {
  h.store.workspaces = [workspace('repo')];
  h.store.workspaceGitStatus = {};
  h.store.loadWorkspaceGitStatus.mockClear();
  vi.spyOn(window, 'setInterval');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWorkspaceGitStatus', () => {
  it('loads and polls the status of a git backed workspace', () => {
    h.store.workspaceGitStatus = { [WS_ID]: ready };

    const { result } = renderHook(() => useWorkspaceGitStatus({ workspaceId: WS_ID }));

    expect(result.current).toEqual(ready);
    expect(h.store.loadWorkspaceGitStatus).toHaveBeenCalledWith({ workspaceId: WS_ID });
    expect(window.setInterval).toHaveBeenCalledOnce();
  });

  it('mounts no timer and reports nothing for a standalone workspace', () => {
    h.store.workspaces = [workspace('simple')];
    h.store.workspaceGitStatus = { [WS_ID]: ready };

    const { result } = renderHook(() => useWorkspaceGitStatus({ workspaceId: WS_ID }));

    expect(result.current).toBeNull();
    expect(h.store.loadWorkspaceGitStatus).not.toHaveBeenCalled();
    expect(window.setInterval).not.toHaveBeenCalled();
  });

  it('mounts no timer for a multi project workspace', () => {
    h.store.workspaces = [workspace('composite')];

    const { result } = renderHook(() => useWorkspaceGitStatus({ workspaceId: WS_ID }));

    expect(result.current).toBeNull();
    expect(window.setInterval).not.toHaveBeenCalled();
  });
});
