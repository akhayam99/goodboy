// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

const { state, repoMocks } = vi.hoisted(() => ({
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
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));
vi.mock('../../../../shared/lib/repo', () => repoMocks);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }));
vi.mock('./ProjectBaseBranchInput', () => ({
  ProjectBaseBranchInput: ({ project }: { project: { name: string } }) => (
    <span data-testid="base-branch">{project.name}</span>
  ),
}));

import { WorkspaceProjectsSection } from './WorkspaceProjectsSection';

const WORKSPACE_ID = 'ws-target' as WorkspaceId;

const conflict = {
  project: {
    id: 'proj-known',
    name: 'storefront-web',
    rootPath: '/repos/storefront-web',
    kind: 'repo',
  },
  sourceWorkspace: { id: 'ws-legacy', name: 'storefront-web' },
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

    await addPath('/repos/storefront-web');

    await waitFor(() => screen.getByText('already in storefront-web with 4 sessions'));
  });

  it('adopts the project into this workspace through Move it here', async () => {
    state.addProject.mockResolvedValueOnce({ kind: 'conflict', conflict });
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);
    await addPath('/repos/storefront-web');
    await waitFor(() => screen.getByText('already in storefront-web with 4 sessions'));

    fireEvent.click(screen.getByRole('button', { name: 'Move it here' }));

    await waitFor(() =>
      expect(state.adoptProject).toHaveBeenCalledWith({
        projectId: 'proj-known',
        targetWorkspaceId: WORKSPACE_ID,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('already in storefront-web with 4 sessions')).toBeNull(),
    );
  });

  it('dismisses the conflict row through Keep there without adopting', async () => {
    state.addProject.mockResolvedValueOnce({ kind: 'conflict', conflict });
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);
    await addPath('/repos/storefront-web');
    await waitFor(() => screen.getByText('already in storefront-web with 4 sessions'));

    fireEvent.click(screen.getByRole('button', { name: 'Keep there' }));

    expect(screen.queryByText('already in storefront-web with 4 sessions')).toBeNull();
    expect(state.adoptProject).not.toHaveBeenCalled();
  });

  it('links a fresh path and clears the field', async () => {
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    await addPath('/repos/api');

    expect(state.addProject).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      rootPath: '/repos/api',
      requireRepo: true,
    });
    await waitFor(() =>
      expect((screen.getByLabelText('Project path') as HTMLInputElement).value).toBe(''),
    );
  });

  it('shows the base branch field only on repository rows', () => {
    state.projects = [
      {
        id: 'proj-docs',
        name: 'notify-relay',
        rootPath: '/repos/notify-relay',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
      },
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    expect(screen.getAllByTestId('base-branch').map((node) => node.textContent)).toEqual([
      'ledger-core',
    ]);
  });

  it('unlinks a project only after its anchored confirm', async () => {
    state.projects = [
      {
        id: 'proj-docs',
        name: 'notify-relay',
        rootPath: '/repos/notify-relay',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Unlink notify-relay' }));
    expect(state.removeProject).not.toHaveBeenCalled();

    const confirm = screen.getByRole('dialog', { name: 'Unlink notify-relay?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Unlink' }));

    await waitFor(() =>
      expect(state.removeProject).toHaveBeenCalledWith({ projectId: 'proj-docs' }),
    );
  });

  it('keeps the project when the unlink confirm is cancelled', async () => {
    state.projects = [
      {
        id: 'proj-docs',
        name: 'notify-relay',
        rootPath: '/repos/notify-relay',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Unlink notify-relay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(state.removeProject).not.toHaveBeenCalled();
  });
});
