// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state, repoMocks, showToast } = vi.hoisted(() => ({
  state: {
    projects: [] as ReadonlyArray<Record<string, unknown>>,
    addProject: vi.fn(async (): Promise<Record<string, unknown>> => ({
      kind: 'linked',
      project: { id: 'proj-1', name: 'api', rootPath: '/repos/api' },
    })),
    addProjects: vi.fn(async () => ({ linked: [], conflicts: [] })),
    adoptProject: vi.fn(async () => ({
      movedSessionCount: 4,
      ambiguousSessionCount: 0,
      mergedWorkspace: true,
    })),
    previewProjectAdoption: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
    removeProject: vi.fn(async () => undefined),
  },
  repoMocks: {
    validateGitRepo: vi.fn(async () => ({
      isRepo: true,
      rootPath: '/repos/api',
      resolvedPath: '/repos/api',
      error: null,
    })),
    scanChildRepos: vi.fn(async (): Promise<ReadonlyArray<never>> => []),
    initRepo: vi.fn(async () => ({ rootPath: '/repos/api' })),
  },
  showToast: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));
vi.mock('../../../../shared/lib/repo', () => repoMocks);
vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }));

import { WorkspaceProjectsSection } from './WorkspaceProjectsSection';

const WORKSPACE_ID = 'ws-target' as WorkspaceId;

const conflict = {
  project: { id: 'proj-known', name: 'app-web', rootPath: '/repos/app-web', kind: 'repo' },
  sourceWorkspace: { id: 'ws-legacy', name: 'app-web' },
  sessionCount: 4,
  isShell: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.projects = [];
});
afterEach(cleanup);

const addPath = async (path: string) => {
  fireEvent.change(screen.getByLabelText('Project path'), { target: { value: path } });
  fireEvent.click(screen.getByRole('button', { name: /add/i }));
  await waitFor(() => expect(state.addProject).toHaveBeenCalled());
};

describe('WorkspaceProjectsSection', () => {
  it('shows an inline conflict row when the path belongs to another workspace', async () => {
    state.addProject.mockResolvedValueOnce({ kind: 'conflict', conflict });
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    await addPath('/repos/app-web');

    await waitFor(() => screen.getByText('already in app-web with 4 sessions'));
    expect(showToast).not.toHaveBeenCalled();
  });

  it('adopts the project into this workspace through Move it here', async () => {
    state.addProject.mockResolvedValueOnce({ kind: 'conflict', conflict });
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);
    await addPath('/repos/app-web');
    await waitFor(() => screen.getByText('already in app-web with 4 sessions'));

    fireEvent.click(screen.getByRole('button', { name: 'Move it here' }));

    await waitFor(() =>
      expect(state.adoptProject).toHaveBeenCalledWith({
        projectId: 'proj-known',
        targetWorkspaceId: WORKSPACE_ID,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('already in app-web with 4 sessions')).toBeNull(),
    );
    expect(showToast).toHaveBeenCalledWith('success', 'moved app-web here');
  });

  it('dismisses the conflict row through Keep there without adopting', async () => {
    state.addProject.mockResolvedValueOnce({ kind: 'conflict', conflict });
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);
    await addPath('/repos/app-web');
    await waitFor(() => screen.getByText('already in app-web with 4 sessions'));

    fireEvent.click(screen.getByRole('button', { name: 'Keep there' }));

    expect(screen.queryByText('already in app-web with 4 sessions')).toBeNull();
    expect(state.adoptProject).not.toHaveBeenCalled();
  });

  it('keeps the plain link toast for a fresh path', async () => {
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    await addPath('/repos/api');

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('success', 'linked api'));
  });
});
