// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Project, ProjectId, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  store: {
    projects: [] as ReadonlyArray<Project>,
    projectGitStatus: {} as Record<string, WorkspaceGitStatus | undefined>,
    loadProjectGitStatus: vi.fn(async () => undefined),
  },
}));

vi.mock('zustand/react/shallow', () => ({ useShallow: <T>(selector: T) => selector }));
vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (state: typeof h.store) => T) => selector(h.store),
}));

import { useProjectGitStatuses } from './index';

const WS_ID = 'ws-1' as WorkspaceId;
const ready: WorkspaceGitStatus = {
  state: 'ready',
  branch: 'main',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/main',
  inProgress: null,
};

const projectOf = ({
  id,
  kind,
}: {
  readonly id: string;
  readonly kind: Project['kind'];
}): Project =>
  ({ id: id as ProjectId, workspaceId: WS_ID, name: id, rootPath: `/repo/${id}`, kind }) as Project;

beforeEach(() => {
  vi.useFakeTimers();
  h.store.projects = [
    projectOf({ id: 'repo-1', kind: 'repo' }),
    projectOf({ id: 'folder-1', kind: 'folder' }),
    projectOf({ id: 'repo-2', kind: 'repo' }),
  ];
  h.store.projectGitStatus = { 'repo-1': ready };
  h.store.loadProjectGitStatus.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useProjectGitStatuses', () => {
  it('returns one entry per repo project and loads each status', () => {
    const { result } = renderHook(() => useProjectGitStatuses({ workspaceId: WS_ID }));

    expect(result.current).toEqual([
      { project: h.store.projects[0], status: ready },
      { project: h.store.projects[2], status: null },
    ]);
    expect(h.store.loadProjectGitStatus).toHaveBeenCalledWith({ projectId: 'repo-1' });
    expect(h.store.loadProjectGitStatus).toHaveBeenCalledWith({ projectId: 'repo-2' });
  });

  it('polls every repo project while the document is visible', () => {
    renderHook(() => useProjectGitStatuses({ workspaceId: WS_ID }));
    h.store.loadProjectGitStatus.mockClear();

    act(() => vi.advanceTimersByTime(30_000));

    expect(h.store.loadProjectGitStatus).toHaveBeenCalledTimes(2);
    expect(h.store.loadProjectGitStatus).toHaveBeenCalledWith({ projectId: 'repo-1' });
    expect(h.store.loadProjectGitStatus).toHaveBeenCalledWith({ projectId: 'repo-2' });
  });
});
