// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, validateMock } = vi.hoisted(() => ({
  state: {
    addWorkspace: vi.fn(async () => ({ id: 'ws-new' })),
    addCompositeWorkspace: vi.fn(async () => ({ id: 'ws-composite' })),
    addSimpleWorkspace: vi.fn(async () => ({ id: 'ws-simple' })),
    setCurrentWorkspace: vi.fn(async () => undefined),
    workspaces: [] as ReadonlyArray<{
      id: string;
      name: string;
      rootPath: string;
      kind?: 'repo' | 'composite' | 'simple';
    }>,
  },
  validateMock: vi.fn(async () => ({ isRepo: true })),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      addWorkspace: typeof state.addWorkspace;
      addCompositeWorkspace: typeof state.addCompositeWorkspace;
      addSimpleWorkspace: typeof state.addSimpleWorkspace;
      setCurrentWorkspace: typeof state.setCurrentWorkspace;
    }) => T,
  ) =>
    selector({
      addWorkspace: state.addWorkspace,
      addCompositeWorkspace: state.addCompositeWorkspace,
      addSimpleWorkspace: state.addSimpleWorkspace,
      setCurrentWorkspace: state.setCurrentWorkspace,
    }),
  useWorkspaces: () => state.workspaces,
}));

vi.mock('../../../../shared/lib/repo', () => ({
  validateGitRepo: validateMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => '/picked/path'),
}));

vi.mock('../../defaultSimpleWorkspacePath', () => ({
  defaultSimpleWorkspacePath: vi.fn(async () => '/home/test/Documents/Goodboy/my-workspace'),
}));

import { WorkspaceLinkForm, type WorkspaceLinkMode } from './index';

const ALL_MODES: ReadonlyArray<WorkspaceLinkMode> = ['single', 'multi', 'simple'];
const DRAFT_KEY = 'goodboy:test-workspace-link-draft';

beforeEach(() => {
  state.addWorkspace = vi.fn(async () => ({ id: 'ws-new' }));
  state.addCompositeWorkspace = vi.fn(async () => ({ id: 'ws-composite' }));
  state.addSimpleWorkspace = vi.fn(async () => ({ id: 'ws-simple' }));
  state.setCurrentWorkspace = vi.fn(async () => undefined);
  state.workspaces = [];
  localStorage.clear();
  validateMock.mockClear();
  validateMock.mockResolvedValue({ isRepo: true });
});
afterEach(cleanup);

describe('WorkspaceLinkForm', () => {
  it('renders the workspace modes and repository helper hint without dialog chrome', () => {
    render(
      <WorkspaceLinkForm
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        showBreadcrumb={false}
        modes={ALL_MODES}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Single project' })).toBeDefined();
    expect(screen.getByText(/the directory needs a .git folder/i)).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a Cancel button that calls the form cancellation handler', () => {
    const onCancel = vi.fn();
    render(
      <WorkspaceLinkForm
        onComplete={vi.fn()}
        onCancel={onCancel}
        showBreadcrumb={false}
        modes={ALL_MODES}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('hides the type picker when only one mode is allowed', () => {
    render(
      <WorkspaceLinkForm
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        showBreadcrumb={false}
        modes={['simple']}
      />,
    );
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create workspace' })).toBeDefined();
  });

  it('validates the typed path and surfaces a valid-repo confirmation', async () => {
    render(
      <WorkspaceLinkForm
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        showBreadcrumb={false}
        modes={ALL_MODES}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('/path/to/repo'), {
      target: { value: '/some/repo' },
    });
    await waitFor(() => screen.getByText(/valid git repository/i), { timeout: 2000 });
    expect(validateMock).toHaveBeenCalledWith('/some/repo');
  });

  it('creates a simple workspace from a prefilled editable directory', async () => {
    const onComplete = vi.fn();
    render(
      <WorkspaceLinkForm
        onComplete={onComplete}
        onCancel={vi.fn()}
        showBreadcrumb={false}
        modes={ALL_MODES}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Standalone' }));
    const directory = await screen.findByDisplayValue('/home/test/Documents/Goodboy/my-workspace');
    fireEvent.change(screen.getByDisplayValue('My workspace'), {
      target: { value: 'History notes' },
    });
    fireEvent.change(directory, { target: { value: '/tmp/history-notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));

    await waitFor(() =>
      expect(state.addSimpleWorkspace).toHaveBeenCalledWith({
        name: 'History notes',
        path: '/tmp/history-notes',
      }),
    );
    expect(validateMock).not.toHaveBeenCalled();
    expect(state.setCurrentWorkspace).toHaveBeenCalledWith('ws-simple');
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('restores a draft across unmount and remount', async () => {
    state.workspaces = [
      { id: 'ws-1', name: 'alpha', rootPath: '/repos/alpha', kind: 'repo' },
      { id: 'ws-2', name: 'beta', rootPath: '/repos/beta', kind: 'repo' },
    ];

    const firstRender = render(
      <WorkspaceLinkForm
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        showBreadcrumb={false}
        modes={ALL_MODES}
        draftStorageKey={DRAFT_KEY}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('/path/to/repo'), {
      target: { value: '/repos/solo' },
    });
    fireEvent.click(screen.getByRole('tab', { name: /multi project/i }));
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }));
    fireEvent.click(screen.getByRole('button', { name: /beta/i }));
    fireEvent.change(screen.getByLabelText('alpha mount name'), { target: { value: 'main' } });
    fireEvent.change(screen.getByLabelText('beta mount name'), { target: { value: 'docs' } });
    fireEvent.change(screen.getByLabelText('Container path'), { target: { value: '/tmp/work' } });
    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'My fleet' } });
    await waitFor(() =>
      expect(localStorage.getItem(DRAFT_KEY)).toContain('"containerPath":"/tmp/work"'),
    );
    await waitFor(() =>
      expect(localStorage.getItem(DRAFT_KEY)).toContain('"selected":["ws-1","ws-2"]'),
    );
    await waitFor(() =>
      expect(localStorage.getItem(DRAFT_KEY)).toContain('"containerEdited":true'),
    );
    firstRender.unmount();

    render(
      <WorkspaceLinkForm
        onComplete={vi.fn()}
        onCancel={vi.fn()}
        showBreadcrumb={false}
        modes={ALL_MODES}
        draftStorageKey={DRAFT_KEY}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /multi project/i, selected: true })).toBeDefined(),
    );
    await waitFor(() =>
      expect((screen.getByLabelText('Container path') as HTMLInputElement).value).toBe('/tmp/work'),
    );
    expect((screen.getByLabelText('Workspace name') as HTMLInputElement).value).toBe('My fleet');
    expect((screen.getByLabelText('alpha mount name') as HTMLInputElement).value).toBe('main');
    expect((screen.getByLabelText('beta mount name') as HTMLInputElement).value).toBe('docs');
  });

  it('clears the persisted draft when cancelled', async () => {
    const onCancel = vi.fn();
    render(
      <WorkspaceLinkForm
        onComplete={vi.fn()}
        onCancel={onCancel}
        showBreadcrumb={false}
        modes={ALL_MODES}
        draftStorageKey={DRAFT_KEY}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('/path/to/repo'), {
      target: { value: '/repos/solo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('clears the persisted draft when submitted', async () => {
    const onComplete = vi.fn();
    render(
      <WorkspaceLinkForm
        onComplete={onComplete}
        onCancel={vi.fn()}
        showBreadcrumb={false}
        modes={ALL_MODES}
        draftStorageKey={DRAFT_KEY}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('/path/to/repo'), {
      target: { value: '/repos/solo' },
    });
    await waitFor(() => screen.getByText(/valid git repository/i), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Add workspace' }));

    await waitFor(() =>
      expect(state.addWorkspace).toHaveBeenCalledWith({ rootPath: '/repos/solo' }),
    );
    expect(onComplete).toHaveBeenCalledOnce();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
