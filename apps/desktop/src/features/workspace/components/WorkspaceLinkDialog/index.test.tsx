// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, validateMock } = vi.hoisted(() => ({
  state: {
    addWorkspace: vi.fn(async () => ({ id: 'ws-new' })),
    addCompositeWorkspace: vi.fn(async () => ({ id: 'ws-composite' })),
    addSimpleWorkspace: vi.fn(async () => ({ id: 'ws-simple' })),
    setCurrentWorkspace: vi.fn(async () => undefined),
    workspaces: [] as ReadonlyArray<{ id: string }>,
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

import { WorkspaceLinkDialog } from './index';

beforeEach(() => {
  state.addWorkspace = vi.fn(async () => ({ id: 'ws-new' }));
  state.addCompositeWorkspace = vi.fn(async () => ({ id: 'ws-composite' }));
  state.addSimpleWorkspace = vi.fn(async () => ({ id: 'ws-simple' }));
  state.setCurrentWorkspace = vi.fn(async () => undefined);
  state.workspaces = [];
  validateMock.mockClear();
  validateMock.mockResolvedValue({ isRepo: true });
});
afterEach(cleanup);

describe('WorkspaceLinkDialog', () => {
  it('renders the dialog title and the repository helper hint', () => {
    render(<WorkspaceLinkDialog open onClose={vi.fn()} />);
    expect(
      screen.getByText(/add a project, link projects, or create a simple workspace/i),
    ).toBeDefined();
  });

  it('renders a Cancel button that closes the dialog', () => {
    const onClose = vi.fn();
    render(<WorkspaceLinkDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('validates the typed path and surfaces a valid-repo confirmation', async () => {
    render(<WorkspaceLinkDialog open onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('/path/to/repo'), {
      target: { value: '/some/repo' },
    });
    await waitFor(() => screen.getByText(/valid git repository/i), { timeout: 2000 });
    expect(validateMock).toHaveBeenCalledWith('/some/repo');
  });

  it('creates a simple workspace from a prefilled editable directory', async () => {
    render(<WorkspaceLinkDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Simple' }));
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
  });
});
