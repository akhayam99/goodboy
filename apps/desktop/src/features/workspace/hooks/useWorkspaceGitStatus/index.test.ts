// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Project, ProjectId, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  store: {
    projects: [] as ReadonlyArray<Project>,
    projectGitStatus: {} as Record<string, WorkspaceGitStatus | undefined>,
    loadProjectGitStatus: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

import { useWorkspaceGitStatus } from './index';

const WS_ID = 'ws-1' as WorkspaceId;
const PROJECT_ID = 'project-1' as ProjectId;

const ready: WorkspaceGitStatus = {
  state: 'ready',
  branch: 'main',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/main',
  inProgress: null,
};

const project = (kind: Project['kind']): Project =>
  ({ id: PROJECT_ID, workspaceId: WS_ID, name: 'ws', rootPath: '/repo', kind }) as Project;

beforeEach(() => {
  h.store.projects = [project('repo')];
  h.store.projectGitStatus = {};
  h.store.loadProjectGitStatus.mockClear();
  vi.spyOn(window, 'setInterval');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWorkspaceGitStatus', () => {
  it('loads and polls the status of a git backed workspace', () => {
    h.store.projectGitStatus = { [PROJECT_ID]: ready };

    const { result } = renderHook(() => useWorkspaceGitStatus({ workspaceId: WS_ID }));

    expect(result.current).toEqual(ready);
    expect(h.store.loadProjectGitStatus).toHaveBeenCalledWith({ projectId: PROJECT_ID });
    expect(window.setInterval).toHaveBeenCalledOnce();
  });

  it('mounts no timer and reports nothing for a folder project', () => {
    h.store.projects = [project('folder')];
    h.store.projectGitStatus = { [PROJECT_ID]: ready };

    const { result } = renderHook(() => useWorkspaceGitStatus({ workspaceId: WS_ID }));

    expect(result.current).toBeNull();
    expect(h.store.loadProjectGitStatus).not.toHaveBeenCalled();
    expect(window.setInterval).not.toHaveBeenCalled();
  });

  it('mounts no timer for a multi project workspace', () => {
    h.store.projects = [];

    const { result } = renderHook(() => useWorkspaceGitStatus({ workspaceId: WS_ID }));

    expect(result.current).toBeNull();
    expect(window.setInterval).not.toHaveBeenCalled();
  });
});
