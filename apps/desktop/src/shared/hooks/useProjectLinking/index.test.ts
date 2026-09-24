// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state, repoMocks, dialog } = vi.hoisted(() => ({
  state: {
    projects: [] as ReadonlyArray<Record<string, unknown>>,
    addProject: vi.fn(async (): Promise<Record<string, unknown>> => ({
      kind: 'linked',
      project: { id: 'proj-1', name: 'ledger-core', rootPath: '/repos/ledger-core' },
    })),
    addProjects: vi.fn(async () => ({ linked: [], conflicts: [] })),
    adoptProject: vi.fn(async () => undefined),
    previewProjectAdoption: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
    removeProject: vi.fn(async () => undefined),
  },
  repoMocks: {
    validateGitRepo: vi.fn(async () => ({
      isRepo: true,
      rootPath: '/repos/ledger-core',
      resolvedPath: '/repos/ledger-core',
      error: null,
    })),
    scanChildRepos: vi.fn(async (): Promise<ReadonlyArray<{ name: string; path: string }>> => []),
    initRepo: vi.fn(async () => ({ rootPath: '/repos/fresh' })),
  },
  dialog: { open: vi.fn(async (): Promise<string | null> => null) },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T>(selector: (s: typeof state) => T) => selector(state),
}));
vi.mock('../../lib/repo', () => repoMocks);
vi.mock('@tauri-apps/plugin-dialog', () => dialog);

import { useProjectLinking } from './index';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;

const conflict = {
  project: { id: 'proj-known', name: 'notify-relay', rootPath: '/repos/notify-relay' },
  sourceWorkspace: { id: 'ws-other', name: 'Northwind' },
  sessionCount: 2,
  isShell: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('useProjectLinking', () => {
  it('offers detected child repositories instead of linking a parent folder', async () => {
    repoMocks.validateGitRepo.mockResolvedValueOnce({
      isRepo: false,
      rootPath: '',
      resolvedPath: '/repos',
      error: null,
    });
    repoMocks.scanChildRepos.mockResolvedValueOnce([
      { name: 'ledger-core', path: '/repos/ledger-core' },
    ]);
    const { result } = renderHook(() => useProjectLinking({ workspaceId: WORKSPACE_ID }));

    await act(() => result.current.link({ rootPath: '/repos' }));

    expect(state.addProject).not.toHaveBeenCalled();
    expect(result.current.detected?.repos).toHaveLength(1);
  });

  it('notes a conflict when the path belongs to another workspace', async () => {
    state.addProject.mockResolvedValueOnce({ kind: 'conflict', conflict });
    const { result } = renderHook(() => useProjectLinking({ workspaceId: WORKSPACE_ID }));

    await act(() => result.current.link({ rootPath: '/repos/notify-relay' }));

    expect(result.current.conflicts.map((entry) => entry.project.id)).toEqual(['proj-known']);
  });

  it('links a plain folder without asking for a repository', async () => {
    dialog.open.mockResolvedValueOnce('/notes/runbooks');
    const { result } = renderHook(() => useProjectLinking({ workspaceId: WORKSPACE_ID }));

    await act(() => result.current.linkPlainFolder());

    expect(repoMocks.validateGitRepo).not.toHaveBeenCalled();
    expect(state.addProject).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      rootPath: '/notes/runbooks',
      requireRepo: false,
    });
  });

  it('surfaces a failure as its error instead of throwing', async () => {
    state.addProject.mockRejectedValueOnce(new Error('No git repository at /tmp/empty.'));
    const { result } = renderHook(() => useProjectLinking({ workspaceId: WORKSPACE_ID }));

    await act(() => result.current.link({ rootPath: '/tmp/empty' }));

    await waitFor(() => expect(result.current.error).toContain('No git repository'));
    expect(result.current.busy).toBe(false);
  });

  it('unlinks through the store and reports a failure inline', async () => {
    state.removeProject.mockRejectedValueOnce(new Error('database is locked'));
    const { result } = renderHook(() => useProjectLinking({ workspaceId: WORKSPACE_ID }));

    await act(() =>
      result.current.unlink({ project: { id: 'proj-1', name: 'ledger-core' } as never }),
    );

    expect(state.removeProject).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(result.current.error).toContain('database is locked');
  });
});
