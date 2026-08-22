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
  validateMock: vi.fn(async () => ({ isRepo: true, resolvedPath: '/some/repo' })),
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

const { onboarding } = vi.hoisted(() => ({
  onboarding: { wizardDone: true, reopenWizard: vi.fn() },
}));

vi.mock('../../../onboarding/onboarding-store', () => ({
  isWizardDone: () => onboarding.wizardDone,
  reopenWizard: onboarding.reopenWizard,
}));

import { WorkspaceLinkDialog } from './index';

beforeEach(() => {
  state.addWorkspace = vi.fn(async () => ({ id: 'ws-new' }));
  state.addCompositeWorkspace = vi.fn(async () => ({ id: 'ws-composite' }));
  state.addSimpleWorkspace = vi.fn(async () => ({ id: 'ws-simple' }));
  state.setCurrentWorkspace = vi.fn(async () => undefined);
  state.workspaces = [];
  validateMock.mockClear();
  validateMock.mockResolvedValue({ isRepo: true, resolvedPath: '/some/repo' });
  onboarding.wizardDone = true;
  onboarding.reopenWizard.mockClear();
});
afterEach(cleanup);

describe('WorkspaceLinkDialog', () => {
  it('mounts the shared form only while open', () => {
    const { rerender } = render(
      <WorkspaceLinkDialog open={false} onClose={vi.fn()} onOfferRepo={vi.fn()} />,
    );
    expect(screen.queryByRole('tab', { name: 'Single project' })).toBeNull();

    rerender(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Single project' })).toBeDefined();
  });

  it('pins the form actions in the dialog footer instead of the scrolling body', () => {
    render(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={vi.fn()} />);

    const submit = screen.getByRole('button', { name: 'Add workspace' });
    const form = screen.getByRole('tab', { name: 'Single project' }).closest('form');

    expect(submit.closest('footer')).not.toBeNull();
    expect(form).not.toBeNull();
    expect(form?.contains(submit)).toBe(false);
    expect(submit.getAttribute('form')).toBe(form?.getAttribute('id'));
  });

  it('submits the form from the footer action and closes on success', async () => {
    const onClose = vi.fn();
    render(<WorkspaceLinkDialog open onClose={onClose} onOfferRepo={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('/path/to/project'), {
      target: { value: '/some/repo' },
    });
    await waitFor(() => screen.getByText(/valid git repository/i), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Add workspace' }));

    await waitFor(() =>
      expect(state.addWorkspace).toHaveBeenCalledWith({ rootPath: '/some/repo' }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(onboarding.reopenWizard).not.toHaveBeenCalled();
  });

  it('offers a repository right after a folder with no git lands as a simple workspace', async () => {
    state.addWorkspace = vi.fn(async () => ({
      id: 'ws-new',
      sessionsRoot: '/some/fresh-idea',
    }));
    validateMock.mockResolvedValue({ isRepo: false, resolvedPath: '/some/fresh-idea' });
    const onOfferRepo = vi.fn();
    render(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={onOfferRepo} />);

    fireEvent.change(screen.getByPlaceholderText('/path/to/project'), {
      target: { value: '/some/fresh-idea' },
    });
    await waitFor(() => screen.getByText(/no git repository here yet/i), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Add workspace' }));

    await waitFor(() => expect(onOfferRepo).toHaveBeenCalledOnce());
  });

  it('leaves a git-backed folder alone instead of offering it a repository', async () => {
    state.addWorkspace = vi.fn(async () => ({ id: 'ws-new', sessionsRoot: '/some/repo' }));
    const onOfferRepo = vi.fn();
    render(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={onOfferRepo} />);

    fireEvent.change(screen.getByPlaceholderText('/path/to/project'), {
      target: { value: '/some/repo' },
    });
    await waitFor(() => screen.getByText(/valid git repository/i), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Add workspace' }));

    await waitFor(() => expect(state.addWorkspace).toHaveBeenCalled());
    expect(onOfferRepo).not.toHaveBeenCalled();
  });

  it('resumes an unfinished setup wizard once the workspace exists', async () => {
    onboarding.wizardDone = false;
    render(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('/path/to/project'), {
      target: { value: '/some/repo' },
    });
    await waitFor(() => screen.getByText(/valid git repository/i), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Add workspace' }));

    await waitFor(() => expect(onboarding.reopenWizard).toHaveBeenCalledWith('setup'));
  });
});
