// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, repoMocks, dialogMock } = vi.hoisted(() => ({
  state: {
    addWorkspace: vi.fn(async () => ({
      id: 'ws-direct',
      name: 'alpha',
      sessionsRoot: '/repos/alpha',
    })),
    createWorkspace: vi.fn(async ({ name }: { name: string }) => ({
      id: 'ws-created',
      name,
      sessionsRoot: null,
    })),
    addProject: vi.fn(async (): Promise<Record<string, unknown>> => ({
      kind: 'linked',
      project: { id: 'proj-1', rootPath: '/repos/alpha' },
    })),
    addProjects: vi.fn(async () => ({
      linked: [
        { id: 'proj-1', rootPath: '/parent/alpha' },
        { id: 'proj-2', rootPath: '/parent/beta' },
      ],
      conflicts: [],
    })),
    adoptProject: vi.fn(async () => ({
      movedSessionCount: 5,
      ambiguousSessionCount: 0,
      mergedWorkspace: true,
    })),
    previewProjectAdoption: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
    removeProject: vi.fn(async () => undefined),
    setCurrentWorkspace: vi.fn(async () => undefined),
    projects: [] as ReadonlyArray<{
      id: string;
      workspaceId: string;
      name: string;
      rootPath: string;
      kind: 'repo' | 'folder';
    }>,
  },
  repoMocks: {
    validateGitRepo: vi.fn<
      (path: string) => Promise<{
        isRepo: boolean;
        rootPath: string | null;
        resolvedPath: string | null;
        error: string | null;
      }>
    >(async () => ({
      isRepo: true,
      rootPath: '/repos/alpha',
      resolvedPath: '/repos/alpha',
      error: null,
    })),
    scanChildRepos: vi.fn(async (): Promise<ReadonlyArray<{ name: string; path: string }>> => []),
    initRepo: vi.fn(async () => ({ rootPath: '/picked/path' })),
  },
  dialogMock: { open: vi.fn(async (): Promise<string | null> => '/picked/path') },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../shared/lib/repo', () => repoMocks);

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: dialogMock.open,
}));

import { WorkspaceLinkForm } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  state.projects = [];
  repoMocks.validateGitRepo.mockResolvedValue({
    isRepo: true,
    rootPath: '/repos/alpha',
    resolvedPath: '/repos/alpha',
    error: null,
  });
  repoMocks.scanChildRepos.mockResolvedValue([]);
  dialogMock.open.mockResolvedValue('/picked/path');
});
afterEach(cleanup);

type FormProps = Parameters<typeof WorkspaceLinkForm>[0];

const renderForm = (props: Partial<FormProps> = {}) =>
  render(
    <WorkspaceLinkForm onComplete={vi.fn()} onCancel={vi.fn()} showBreadcrumb={false} {...props} />,
  );

describe('WorkspaceLinkForm', () => {
  it('renders the two setup choices without dialog chrome', () => {
    renderForm();
    expect(screen.getByRole('radio', { name: /start from a project/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /a workspace with several projects/i })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/standalone/i)).toBeNull();
    expect(screen.queryByText(/mount names/i)).toBeNull();
  });

  it('renders a Cancel button that calls the form cancellation handler', () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('links a picked git repository directly as a project-shaped workspace', async () => {
    const onComplete = vi.fn();
    renderForm({ onComplete });
    fireEvent.click(screen.getByRole('radio', { name: /start from a project/i }));
    fireEvent.click(screen.getByRole('button', { name: /choose a folder/i }));

    await waitFor(() =>
      expect(state.addWorkspace).toHaveBeenCalledWith({ rootPath: '/repos/alpha' }),
    );
    expect(state.setCurrentWorkspace).toHaveBeenCalledWith('ws-direct');
    expect(onComplete).toHaveBeenCalledWith({
      mode: 'project',
      workspace: expect.objectContaining({ id: 'ws-direct' }),
    });
  });

  it('offers detected child repositories and creates a workspace named after the folder', async () => {
    repoMocks.validateGitRepo.mockResolvedValue({
      isRepo: false,
      rootPath: null,
      resolvedPath: '/parent',
      error: null,
    });
    repoMocks.scanChildRepos.mockResolvedValue([
      { name: 'alpha', path: '/parent/alpha' },
      { name: 'beta', path: '/parent/beta' },
    ]);
    dialogMock.open.mockResolvedValue('/parent');
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /start from a project/i }));
    fireEvent.click(screen.getByRole('button', { name: /choose a folder/i }));

    await waitFor(() => screen.getByText(/2 repositories found in this folder/i));
    fireEvent.click(screen.getByRole('button', { name: /link 2 projects/i }));

    await waitFor(() => expect(state.createWorkspace).toHaveBeenCalledWith({ name: 'parent' }));
    expect(state.addProjects).toHaveBeenCalledWith({
      workspaceId: 'ws-created',
      rootPaths: ['/parent/alpha', '/parent/beta'],
    });
    await waitFor(() => screen.getByRole('button', { name: 'Done' }));
  });

  it('surfaces an error when the picked folder has no git anywhere', async () => {
    repoMocks.validateGitRepo.mockResolvedValue({
      isRepo: false,
      rootPath: null,
      resolvedPath: '/empty',
      error: null,
    });
    dialogMock.open.mockResolvedValue('/empty');
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /start from a project/i }));
    fireEvent.click(screen.getByRole('button', { name: /choose a folder/i }));

    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).toContain('no git repository at /empty');
    expect(state.addWorkspace).not.toHaveBeenCalled();
  });

  it('links a plain folder without git through the quiet escape', async () => {
    const onComplete = vi.fn();
    dialogMock.open.mockResolvedValue('/notes');
    renderForm({ onComplete });
    fireEvent.click(screen.getByRole('radio', { name: /start from a project/i }));
    fireEvent.click(screen.getByRole('button', { name: /link a plain folder/i }));

    await waitFor(() => expect(state.addWorkspace).toHaveBeenCalledWith({ rootPath: '/notes' }));
    expect(onComplete).toHaveBeenCalledWith({
      mode: 'project',
      workspace: expect.objectContaining({ id: 'ws-direct' }),
    });
  });

  it('creates a named workspace and then adds projects before Done unlocks', async () => {
    const onComplete = vi.fn();
    renderForm({ onComplete });
    fireEvent.click(screen.getByRole('radio', { name: /a workspace with several projects/i }));
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));

    await waitFor(() => expect(state.createWorkspace).toHaveBeenCalledWith({ name: 'Acme' }));
    expect(state.setCurrentWorkspace).toHaveBeenCalledWith('ws-created');

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(done.hasAttribute('disabled')).toBe(true);

    fireEvent.change(screen.getByLabelText('Project path'), {
      target: { value: '/repos/alpha' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() =>
      expect(state.addProject).toHaveBeenCalledWith({
        workspaceId: 'ws-created',
        rootPath: '/repos/alpha',
      }),
    );

    state.projects = [
      {
        id: 'proj-1',
        workspaceId: 'ws-created',
        name: 'alpha',
        rootPath: '/repos/alpha',
        kind: 'repo',
      },
    ];
    fireEvent.change(screen.getByLabelText('Project path'), { target: { value: '/next' } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Done' }).hasAttribute('disabled')).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onComplete).toHaveBeenCalledWith({
      mode: 'workspace',
      workspace: expect.objectContaining({ id: 'ws-created' }),
    });
  });

  it('offers to move a project another workspace already owns instead of failing', async () => {
    const conflict = {
      project: { id: 'proj-known', name: 'api', rootPath: '/repos/api', kind: 'repo' },
      sourceWorkspace: { id: 'ws-legacy', name: 'Legacy' },
      sessionCount: 5,
      isShell: true,
    };
    state.addProject.mockResolvedValueOnce({ kind: 'conflict', conflict });
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /a workspace with several projects/i }));
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    await waitFor(() => expect(state.createWorkspace).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Project path'), { target: { value: '/repos/api' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => screen.getByText('already in Legacy with 5 sessions'));

    fireEvent.click(screen.getByRole('button', { name: 'Move it here' }));

    await waitFor(() =>
      expect(state.adoptProject).toHaveBeenCalledWith({
        projectId: 'proj-known',
        targetWorkspaceId: 'ws-created',
      }),
    );
    await waitFor(() => expect(screen.queryByText('already in Legacy with 5 sessions')).toBeNull());
  });

  it('drops the conflict notice quietly through Keep there', async () => {
    const conflict = {
      project: { id: 'proj-known', name: 'api', rootPath: '/repos/api', kind: 'repo' },
      sourceWorkspace: { id: 'ws-legacy', name: 'Legacy' },
      sessionCount: 5,
      isShell: true,
    };
    state.addProject.mockResolvedValueOnce({ kind: 'conflict', conflict });
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /a workspace with several projects/i }));
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    await waitFor(() => expect(state.createWorkspace).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Project path'), { target: { value: '/repos/api' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    await waitFor(() => screen.getByText('already in Legacy with 5 sessions'));

    fireEvent.click(screen.getByRole('button', { name: 'Keep there' }));

    expect(screen.queryByText('already in Legacy with 5 sessions')).toBeNull();
    expect(state.adoptProject).not.toHaveBeenCalled();
  });

  it('keeps Create workspace blocked while the name is empty', () => {
    renderForm();
    fireEvent.click(screen.getByRole('radio', { name: /a workspace with several projects/i }));
    expect(screen.getByRole('button', { name: 'Create workspace' }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});
