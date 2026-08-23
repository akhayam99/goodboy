// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, repoMocks, dialogMock, onboarding } = vi.hoisted(() => ({
  state: {
    addWorkspace: vi.fn(async () => ({ id: 'ws-new', name: 'repo', sessionsRoot: '/some/repo' })),
    createWorkspace: vi.fn(async ({ name }: { name: string }) => ({
      id: 'ws-created',
      name,
      sessionsRoot: null,
    })),
    addProject: vi.fn(async () => ({ id: 'proj-1', rootPath: '/some/repo' })),
    addProjects: vi.fn(async () => []),
    removeProject: vi.fn(async () => undefined),
    setCurrentWorkspace: vi.fn(async () => undefined),
    projects: [] as ReadonlyArray<{ id: string; workspaceId: string; kind: string }>,
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
      rootPath: '/some/repo',
      resolvedPath: '/some/repo',
      error: null,
    })),
    scanChildRepos: vi.fn(async (): Promise<ReadonlyArray<{ name: string; path: string }>> => []),
    initRepo: vi.fn(async () => ({ rootPath: '/picked/path' })),
  },
  dialogMock: { open: vi.fn(async (): Promise<string | null> => '/some/repo') },
  onboarding: { wizardDone: true, reopenWizard: vi.fn() },
}));

vi.mock('../../../../store', () => {
  const useAppStore = Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
  });
  return { useAppStore };
});

vi.mock('../../../../shared/lib/repo', () => repoMocks);

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: dialogMock.open,
}));

vi.mock('../../../onboarding/onboarding-store', () => ({
  isWizardDone: () => onboarding.wizardDone,
  reopenWizard: onboarding.reopenWizard,
}));

import { WorkspaceLinkDialog } from './index';

beforeEach(() => {
  vi.clearAllMocks();
  state.addWorkspace = vi.fn(async () => ({
    id: 'ws-new',
    name: 'repo',
    sessionsRoot: '/some/repo',
  }));
  state.projects = [];
  repoMocks.validateGitRepo.mockResolvedValue({
    isRepo: true,
    rootPath: '/some/repo',
    resolvedPath: '/some/repo',
    error: null,
  });
  repoMocks.scanChildRepos.mockResolvedValue([]);
  dialogMock.open.mockResolvedValue('/some/repo');
  onboarding.wizardDone = true;
});
afterEach(cleanup);

describe('WorkspaceLinkDialog', () => {
  it('mounts the shared form only while open', () => {
    const { rerender } = render(
      <WorkspaceLinkDialog open={false} onClose={vi.fn()} onOfferRepo={vi.fn()} />,
    );
    expect(screen.queryByRole('radio', { name: /start from a project/i })).toBeNull();

    rerender(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /start from a project/i })).toBeDefined();
  });

  it('pins the form actions in the dialog footer instead of the scrolling body', () => {
    render(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /a workspace with several projects/i }));

    const submit = screen.getByRole('button', { name: 'Create workspace' });
    const form = screen.getByRole('radio', { name: /start from a project/i }).closest('form');

    expect(submit.closest('footer')).not.toBeNull();
    expect(form).not.toBeNull();
    expect(form?.contains(submit)).toBe(false);
    expect(submit.getAttribute('form')).toBe(form?.getAttribute('id'));
  });

  it('links a picked repository and closes on success', async () => {
    const onClose = vi.fn();
    render(<WorkspaceLinkDialog open onClose={onClose} onOfferRepo={vi.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: /start from a project/i }));
    fireEvent.click(screen.getByRole('button', { name: /choose a folder/i }));

    await waitFor(() =>
      expect(state.addWorkspace).toHaveBeenCalledWith({ rootPath: '/some/repo' }),
    );
    expect(onClose).toHaveBeenCalled();
    expect(onboarding.reopenWizard).not.toHaveBeenCalled();
  });

  it('offers a repository right after a plain folder without git lands', async () => {
    state.addWorkspace = vi.fn(async () => ({
      id: 'ws-new',
      name: 'fresh-idea',
      sessionsRoot: '/some/fresh-idea',
    }));
    dialogMock.open.mockResolvedValue('/some/fresh-idea');
    repoMocks.validateGitRepo.mockResolvedValue({
      isRepo: false,
      rootPath: null,
      resolvedPath: '/some/fresh-idea',
      error: null,
    });
    state.projects = [{ id: 'proj-folder', workspaceId: 'ws-new', kind: 'folder' }];
    const onOfferRepo = vi.fn();
    render(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={onOfferRepo} />);

    fireEvent.click(screen.getByRole('radio', { name: /start from a project/i }));
    fireEvent.click(screen.getByRole('button', { name: /link a plain folder/i }));
    await waitFor(() => expect(state.addWorkspace).toHaveBeenCalled());
    await waitFor(() => expect(onOfferRepo).toHaveBeenCalledOnce());
  });

  it('leaves a git-backed folder alone instead of offering it a repository', async () => {
    state.projects = [{ id: 'proj-repo', workspaceId: 'ws-new', kind: 'repo' }];
    const onOfferRepo = vi.fn();
    render(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={onOfferRepo} />);

    fireEvent.click(screen.getByRole('radio', { name: /start from a project/i }));
    fireEvent.click(screen.getByRole('button', { name: /choose a folder/i }));

    await waitFor(() => expect(state.addWorkspace).toHaveBeenCalled());
    expect(onOfferRepo).not.toHaveBeenCalled();
  });

  it('resumes an unfinished setup wizard once the workspace exists', async () => {
    onboarding.wizardDone = false;
    render(<WorkspaceLinkDialog open onClose={vi.fn()} onOfferRepo={vi.fn()} />);

    fireEvent.click(screen.getByRole('radio', { name: /start from a project/i }));
    fireEvent.click(screen.getByRole('button', { name: /choose a folder/i }));

    await waitFor(() => expect(onboarding.reopenWizard).toHaveBeenCalledWith('setup'));
  });
});
