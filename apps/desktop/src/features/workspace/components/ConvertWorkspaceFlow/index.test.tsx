// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

const { listOwnedRepos, createGithubRepo, convertProjectToRepo } = vi.hoisted(() => ({
  listOwnedRepos: vi.fn(),
  createGithubRepo: vi.fn(),
  convertProjectToRepo:
    vi.fn<(params: { projectId: ProjectId; remoteUrl: string }) => Promise<Project>>(),
}));

vi.mock('@goodboy/core', async () => {
  const actual = await vi.importActual<typeof import('@goodboy/core')>('@goodboy/core');
  return {
    ...actual,
    listOwnedRepos,
    createGithubRepo,
  };
});

vi.mock('../../../integrations/github/github', () => ({ tauriGhRunner: {} }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  GitlabIntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
  Project,
  ProjectId,
} from '@goodboy/types';
import { aProject, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ConvertWorkspaceFlow } from './index';
import { chooseListboxValue } from '../../../../__tests__/helpers/listbox';

let useAppStore: StoryStore;

const WORKSPACE = aWorkspace({ name: 'Study space' });

const PROJECT: Project = aProject({
  id: 'project-1' as ProjectId,
  workspaceId: WORKSPACE.id,
  kind: 'folder',
  rootPath: '/tmp/study-space',
});

const GITLAB: GitlabIntegrationBinding = {
  id: 'binding-gitlab' as IntegrationBindingId,
  workspaceId: WORKSPACE.id,
  projectId: null,
  credentialId: 'credential-gitlab' as IntegrationCredentialId,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  provider: 'gitlab',
  config: { userName: 'mara-quint', userId: '7', host: 'gitlab.com' },
};

const setGithub = ({ isAvailable }: { readonly isAvailable: boolean }) =>
  useAppStore.setState({
    githubStatus: isAvailable
      ? { mode: 'gh-cli', available: true, user: 'acme', scopes: [] }
      : { mode: 'absent', available: false },
  });

const connectGitlab = () =>
  useAppStore.setState({ workspaceIntegrations: { [WORKSPACE.id]: [GITLAB] } });

const renderFlow = ({ onClose = vi.fn() }: { readonly onClose?: () => void } = {}) =>
  render(<ConvertWorkspaceFlow workspaceId={WORKSPACE.id} project={PROJECT} onClose={onClose} />);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  convertProjectToRepo.mockReset();
  convertProjectToRepo.mockResolvedValue(PROJECT);
  useAppStore.setState({ workspaces: [WORKSPACE], projects: [PROJECT], convertProjectToRepo });
  setGithub({ isAvailable: true });
  createGithubRepo.mockReset();
  createGithubRepo.mockResolvedValue({
    kind: 'ok',
    repo: {
      nameWithOwner: 'acme/study-space',
      url: 'https://github.com/acme/study-space',
      sshUrl: 'git@github.com:acme/study-space.git',
      isPrivate: true,
    },
  });
  listOwnedRepos.mockReset();
  listOwnedRepos.mockResolvedValue({
    kind: 'ok',
    repos: [
      {
        nameWithOwner: 'acme/widgets',
        url: 'https://github.com/acme/widgets',
        sshUrl: 'git@github.com:acme/widgets.git',
        isPrivate: false,
      },
    ],
  });
});

afterEach(cleanup);

describe('ConvertWorkspaceFlow', () => {
  it('sits in the page as a region, never in a dialog', () => {
    renderFlow();

    screen.getByRole('region', { name: 'Turn this into a dev project' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('converts with the repository the user picked', async () => {
    renderFlow();

    fireEvent.click(screen.getByRole('tab', { name: 'Link existing' }));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLButtonElement>('Repository').disabled).toBe(false),
    );
    chooseListboxValue({ trigger: screen.getByLabelText('Repository'), value: 'acme/widgets' });
    fireEvent.click(screen.getByRole('button', { name: 'Convert to dev project' }));

    await waitFor(() =>
      expect(convertProjectToRepo).toHaveBeenCalledWith({
        projectId: 'project-1',
        remoteUrl: 'https://github.com/acme/widgets',
      }),
    );
    await waitFor(() => screen.getByRole('button', { name: 'Done' }));
  });

  it('ends the body with cancel and the primary inline, never in a footer bar', () => {
    const onClose = vi.fn();
    renderFlow({ onClose });

    const primary = screen.getByRole('button', { name: 'Create repository' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(primary.closest('[data-slot="form-actions"]')).not.toBeNull();
    expect(primary.closest('footer')).toBeNull();
    expect(cancel.parentElement).toBe(primary.parentElement);
    fireEvent.click(cancel);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks the conversion until the chosen host is connected', () => {
    setGithub({ isAvailable: false });
    renderFlow();

    fireEvent.click(screen.getByRole('tab', { name: 'Link existing' }));
    expect(screen.getByText('GitHub is not connected yet')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Convert to dev project' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('takes a pasted remote url for GitLab', async () => {
    connectGitlab();
    renderFlow();

    fireEvent.click(screen.getByRole('tab', { name: 'Link existing' }));
    fireEvent.click(screen.getByRole('tab', { name: 'GitLab' }));
    fireEvent.change(screen.getByPlaceholderText('https://gitlab.com/owner/repo.git'), {
      target: { value: 'git@gitlab.com:acme/widgets.git' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Convert to dev project' }));

    await waitFor(() =>
      expect(convertProjectToRepo).toHaveBeenCalledWith({
        projectId: 'project-1',
        remoteUrl: 'git@gitlab.com:acme/widgets.git',
      }),
    );
  });

  it('never sends the GitHub selection after the user switches to GitLab', async () => {
    connectGitlab();
    renderFlow();

    fireEvent.click(screen.getByRole('tab', { name: 'Link existing' }));
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLButtonElement>('Repository').disabled).toBe(false),
    );
    chooseListboxValue({ trigger: screen.getByLabelText('Repository'), value: 'acme/widgets' });
    fireEvent.click(screen.getByRole('tab', { name: 'GitLab' }));

    expect(
      screen.getByRole('button', { name: 'Convert to dev project' }).hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('https://gitlab.com/owner/repo.git'), {
      target: { value: 'git@gitlab.com:acme/widgets.git' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Convert to dev project' }));

    await waitFor(() =>
      expect(convertProjectToRepo).toHaveBeenCalledWith({
        projectId: 'project-1',
        remoteUrl: 'git@gitlab.com:acme/widgets.git',
      }),
    );
  });

  it('says the cli is signed out instead of pretending the account is empty', async () => {
    listOwnedRepos.mockResolvedValue({ kind: 'unauthenticated' });
    renderFlow();

    fireEvent.click(screen.getByRole('tab', { name: 'Link existing' }));
    await waitFor(() => screen.getByText('the GitHub CLI is installed but not signed in'));
    expect(
      screen.getByRole('button', { name: 'Convert to dev project' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('says the account owns no repositories when gh answers with an empty list', async () => {
    listOwnedRepos.mockResolvedValue({ kind: 'ok', repos: [] });
    renderFlow();

    fireEvent.click(screen.getByRole('tab', { name: 'Link existing' }));
    await waitFor(() => screen.getByText('this account owns no repositories yet'));
  });

  it('keeps the flow and its draft when the user goes to connect the host', () => {
    const onClose = vi.fn();
    const onOpenSettings = vi.fn();
    window.addEventListener('goodboy:open-settings', onOpenSettings);
    setGithub({ isAvailable: false });
    renderFlow({ onClose });

    fireEvent.click(screen.getByRole('tab', { name: 'Link existing' }));
    fireEvent.change(screen.getByPlaceholderText('https://github.com/owner/repo.git'), {
      target: { value: 'https://github.com/acme/widgets.git' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
    window.removeEventListener('goodboy:open-settings', onOpenSettings);

    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { scope: 'tools', tool: 'github' } }),
    );
    expect(
      (screen.getByPlaceholderText('https://github.com/owner/repo.git') as HTMLInputElement).value,
    ).toBe('https://github.com/acme/widgets.git');
  });

  it('picks no visibility for the user and refuses to create until one is chosen', () => {
    renderFlow();

    expect(screen.getByRole('radio', { name: 'Public' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.getByRole('radio', { name: 'Private' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'Create repository' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('names the destination and the visibility in one sentence before creating', async () => {
    renderFlow();

    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));

    expect(
      screen.getByText(
        "Create acme/study-space as a private repository and set it as this folder's origin remote.",
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Create repository' }));

    await waitFor(() =>
      expect(createGithubRepo).toHaveBeenCalledWith({
        runner: {},
        name: 'study-space',
        owner: 'acme',
        visibility: 'private',
      }),
    );
    await waitFor(() =>
      expect(convertProjectToRepo).toHaveBeenCalledWith({
        projectId: 'project-1',
        remoteUrl: 'https://github.com/acme/study-space',
      }),
    );
  });

  it('rejects a repository name starting with a dash instead of cleaning it up', () => {
    renderFlow();

    fireEvent.change(screen.getByLabelText('Repository name'), {
      target: { value: '--upstream=evil' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Public' }));

    expect(screen.getByRole('alert').textContent).toBe(
      'A repository name cannot start with a dash.',
    );
    expect((screen.getByLabelText('Repository name') as HTMLInputElement).value).toBe(
      '--upstream=evil',
    );
    expect(screen.getByRole('button', { name: 'Create repository' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('shows what gh said and leaves the workspace alone when the creation fails', async () => {
    createGithubRepo.mockResolvedValue({
      kind: 'failed',
      message: 'GraphQL: Name already exists on this account',
    });
    renderFlow();

    fireEvent.click(screen.getByRole('radio', { name: 'Public' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create repository' }));

    await waitFor(() => screen.getByText('GraphQL: Name already exists on this account'));
    expect(convertProjectToRepo).not.toHaveBeenCalled();
  });

  it('sets no remote when what GitHub returned is not what was asked for', async () => {
    createGithubRepo.mockResolvedValue({
      kind: 'mismatch',
      expected: { nameWithOwner: 'acme/study-space', isPrivate: true },
      actual: {
        nameWithOwner: 'acme/study-space',
        url: 'https://github.com/acme/study-space',
        sshUrl: 'git@github.com:acme/study-space.git',
        isPrivate: false,
      },
    });
    renderFlow();

    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create repository' }));

    await waitFor(() => screen.getByText(/GitHub returned acme\/study-space, a public repository/));
    expect(screen.getByText(/was not removed/)).toBeDefined();
    expect(convertProjectToRepo).not.toHaveBeenCalled();
  });

  it('discloses the repository left on the account when the local half fails', async () => {
    convertProjectToRepo.mockRejectedValue(new Error('git init refused'));
    renderFlow();

    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create repository' }));

    const disclosure = await screen.findByRole('status');
    expect(disclosure.textContent).toContain('acme/study-space');
    expect(disclosure.textContent).toContain('https://github.com/acme/study-space');
    expect(disclosure.textContent).toContain('was not removed');
    expect(screen.getByText('git init refused')).toBeDefined();
  });

  it('reports an unverified creation without pretending it succeeded', async () => {
    createGithubRepo.mockResolvedValue({
      kind: 'unverified',
      nameWithOwner: 'acme/study-space',
      message:
        'Goodboy created acme/study-space on GitHub but could not read it back: HTTP 502. It exists on GitHub and was not removed.',
    });
    renderFlow();

    fireEvent.click(screen.getByRole('radio', { name: 'Public' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create repository' }));

    await waitFor(() => screen.getByText(/could not read it back/));
    expect(convertProjectToRepo).not.toHaveBeenCalled();
  });
});
