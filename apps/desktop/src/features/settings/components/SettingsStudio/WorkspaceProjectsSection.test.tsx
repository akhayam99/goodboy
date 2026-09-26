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
    setProjectStarred: vi.fn(async () => undefined),
    describeProject: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
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
vi.mock('./GoodboyIgnoreField', () => ({
  GoodboyIgnoreField: () => null,
}));
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
  fireEvent.click(screen.getByRole('button', { name: 'Add project' }));
  fireEvent.change(screen.getByLabelText('Project path'), { target: { value: path } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(state.addProject).toHaveBeenCalled());
};

const armUnlink = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: /unlink/i }));
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
    await waitFor(() => expect(screen.queryByLabelText('Project path')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));
    await waitFor(() =>
      expect((screen.getByLabelText('Project path') as HTMLInputElement).value).toBe(''),
    );
  });

  it('keeps paths out of the rows and the add controls behind one button', () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'repo',
        workspaceId: WORKSPACE_ID,
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    expect(screen.getByRole('heading', { level: 2, name: /projects/i }).textContent).toBe(
      'Projects1',
    );
    expect(screen.queryByText('/repos/ledger-core')).toBeNull();
    expect(screen.queryByText('Repository')).toBeNull();
    expect(screen.getByRole('img', { name: 'Repository' })).toBeDefined();
    expect(screen.queryByLabelText('Project path')).toBeNull();
    expect(screen.queryByRole('button', { name: /plain folder/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));
    const popover = screen.getByRole('dialog', { name: 'Add project' });
    expect(within(popover).getByLabelText('Project path')).toBeDefined();
    expect(within(popover).getByRole('button', { name: 'Browse' })).toBeDefined();
    expect(within(popover).getByRole('button', { name: 'New project' })).toBeDefined();
    expect(within(popover).getByRole('button', { name: 'Link a plain folder' })).toBeDefined();
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

  it('unlinks a project from its menu only after the inline confirm', async () => {
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

    armUnlink('notify-relay');
    expect(state.removeProject).not.toHaveBeenCalled();

    const confirm = screen.getByRole('group', { name: 'Unlink notify-relay?' });
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

    armUnlink('notify-relay');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Unlink notify-relay?' })).toBeNull(),
    );
    expect(state.removeProject).not.toHaveBeenCalled();
  });

  it('stars a project from its row', async () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    const star = screen.getByRole('button', { name: 'Starred: ledger-core' });
    expect(star.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(star);

    await waitFor(() =>
      expect(state.setProjectStarred).toHaveBeenCalledWith({
        projectId: 'proj-ledger',
        isStarred: true,
      }),
    );
    expect(screen.getByText(/Starred projects come first for agents/)).toBeDefined();
  });

  it('shows a starred project as pressed and unstars it', async () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
        starredAt: '2026-09-25T09:00:00.000Z',
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    const star = screen.getByRole('button', { name: 'Starred: ledger-core' });
    expect(star.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(star);

    await waitFor(() =>
      expect(state.setProjectStarred).toHaveBeenCalledWith({
        projectId: 'proj-ledger',
        isStarred: false,
      }),
    );
  });

  it('writes a one-line description in place and saves it on Enter', async () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a description of ledger-core' }));
    const field = screen.getByLabelText('Description of ledger-core');
    fireEvent.change(field, { target: { value: 'Settles payments and writes the ledger' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() =>
      expect(state.describeProject).toHaveBeenCalledWith({
        projectId: 'proj-ledger',
        description: 'Settles payments and writes the ledger',
      }),
    );
  });

  it('keeps the description when editing is cancelled with Escape', () => {
    state.projects = [
      {
        id: 'proj-ledger',
        name: 'ledger-core',
        rootPath: '/repos/ledger-core',
        kind: 'folder',
        workspaceId: WORKSPACE_ID,
        description: 'Settles payments',
      },
    ];
    render(<WorkspaceProjectsSection workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit the description of ledger-core' }));
    const field = screen.getByLabelText('Description of ledger-core');
    fireEvent.change(field, { target: { value: 'Something else' } });
    fireEvent.keyDown(field, { key: 'Escape' });

    expect(screen.getByText('Settles payments')).toBeDefined();
    expect(state.describeProject).not.toHaveBeenCalled();
  });
});
