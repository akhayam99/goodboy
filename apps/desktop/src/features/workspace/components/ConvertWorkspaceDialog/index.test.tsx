// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Workspace } from '@goodboy/types';

const { state, listOwnedRepos } = vi.hoisted(() => ({
  state: {
    githubStatus: { available: true } as { available: boolean } | null,
    workspaceIntegrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
    convertWorkspaceToRepo: vi.fn(async () => undefined),
  },
  listOwnedRepos: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('@goodboy/core', () => ({ listOwnedRepos }));

vi.mock('../../../github/github', () => ({ tauriGhRunner: {} }));

import { ConvertWorkspaceDialog } from './index';

const workspace = {
  id: 'ws-1',
  name: 'Study space',
  rootPath: '/tmp/study-space',
  kind: 'simple',
} as unknown as Workspace;

beforeEach(() => {
  state.githubStatus = { available: true };
  state.workspaceIntegrations = {};
  state.convertWorkspaceToRepo.mockReset();
  state.convertWorkspaceToRepo.mockResolvedValue(undefined);
  listOwnedRepos.mockReset();
  listOwnedRepos.mockResolvedValue([
    {
      nameWithOwner: 'acme/widgets',
      url: 'https://github.com/acme/widgets',
      sshUrl: 'git@github.com:acme/widgets.git',
      isPrivate: false,
    },
  ]);
});

afterEach(cleanup);

describe('ConvertWorkspaceDialog', () => {
  it('converts with the repository the user picked', async () => {
    render(<ConvertWorkspaceDialog open workspace={workspace} onClose={vi.fn()} />);

    await waitFor(() => screen.getByRole('option', { name: 'acme/widgets' }));
    fireEvent.change(screen.getByLabelText('repository'), { target: { value: 'acme/widgets' } });
    fireEvent.click(screen.getByRole('button', { name: 'Convert to dev project' }));

    await waitFor(() =>
      expect(state.convertWorkspaceToRepo).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        remoteUrl: 'https://github.com/acme/widgets',
      }),
    );
    await waitFor(() => screen.getByRole('button', { name: 'Done' }));
  });

  it('blocks the conversion until the chosen host is connected', () => {
    state.githubStatus = { available: false };
    render(<ConvertWorkspaceDialog open workspace={workspace} onClose={vi.fn()} />);

    expect(screen.getByText('GitHub is not connected yet')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Convert to dev project' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('takes a pasted remote url for GitLab', async () => {
    state.workspaceIntegrations = { 'ws-1': [{ provider: 'gitlab' }] };
    render(<ConvertWorkspaceDialog open workspace={workspace} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'GitLab' }));
    fireEvent.change(screen.getByPlaceholderText('https://gitlab.com/owner/repo.git'), {
      target: { value: 'git@gitlab.com:acme/widgets.git' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Convert to dev project' }));

    await waitFor(() =>
      expect(state.convertWorkspaceToRepo).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        remoteUrl: 'git@gitlab.com:acme/widgets.git',
      }),
    );
  });

  it('keeps the draft when the user leaves to connect the host', () => {
    const onClose = vi.fn();
    const dispatched: string[] = [];
    window.addEventListener('goodboy:open-github-studio', () => dispatched.push('github'));
    state.githubStatus = { available: false };
    render(<ConvertWorkspaceDialog open workspace={workspace} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('https://github.com/owner/repo.git'), {
      target: { value: 'https://github.com/acme/widgets.git' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(dispatched).toEqual(['github']);
    expect(
      (screen.getByPlaceholderText('https://github.com/owner/repo.git') as HTMLInputElement).value,
    ).toBe('https://github.com/acme/widgets.git');
  });
});
