// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, Workspace, WorkspaceGitStatus, WorkspaceId } from '@goodboy/types';

const { openInEditorSpy, writeTextSpy, invokeSpy, fastForwardSpy } = vi.hoisted(() => ({
  openInEditorSpy: vi.fn(async () => undefined),
  writeTextSpy: vi.fn(async () => undefined),
  invokeSpy: vi.fn(async () => undefined),
  fastForwardSpy: vi.fn(async () => undefined),
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openInEditor: openInEditorSpy,
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { useAppStore } from '../../../../store';
import { WorkspaceGitPanel } from './index';

const ROOT = '/tmp/fresh-idea';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const workspace: Workspace = {
  id: WORKSPACE_ID,
  name: 'fresh-idea',
  rootPath: ROOT,
  kind: 'repo',
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
};

const status = (overrides: Partial<WorkspaceGitStatus>): WorkspaceGitStatus => ({
  state: 'ready',
  branch: 'main',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/main',
  inProgress: null,
  ...overrides,
});

beforeEach(() => {
  useAppStore.setState({
    workspaces: [workspace],
    workspaceCheckoutPulling: {},
    fastForwardWorkspaceCheckout: fastForwardSpy,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WorkspaceGitPanel init guide', () => {
  it('explains git init and shows the commands rooted at the folder', () => {
    render(<WorkspaceGitPanel rootPath={ROOT} status={status({ state: 'absent' })} />);

    expect(screen.getByText('This folder has no git repository yet')).toBeDefined();
    expect(screen.getByText(`git -C "${ROOT}" init -b main`)).toBeDefined();
    expect(screen.getByText(/Sessions stay unavailable until the first commit/)).toBeDefined();
  });

  it('copies the command and runs nothing when the shortcut is used', () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextSpy },
    });
    render(<WorkspaceGitPanel rootPath={ROOT} status={status({ state: 'absent' })} />);

    fireEvent.click(screen.getByLabelText('copy command: Create the repository'));

    expect(writeTextSpy).toHaveBeenCalledTimes(1);
    expect(writeTextSpy).toHaveBeenCalledWith(`git -C "${ROOT}" init -b main`);
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(openInEditorSpy).not.toHaveBeenCalled();
  });

  it('drops the init step once the repository exists but has no commit', () => {
    render(<WorkspaceGitPanel rootPath={ROOT} status={status({ state: 'unborn' })} />);

    expect(screen.getByText('This repository has no commits yet')).toBeDefined();
    expect(screen.queryByText(`git -C "${ROOT}" init -b main`)).toBeNull();
    expect(screen.getByLabelText('copy command: Make the first commit')).toBeDefined();
  });
});

describe('WorkspaceGitPanel main status', () => {
  it('renders behind, ahead and dirty counts with the editor action', () => {
    render(
      <WorkspaceGitPanel
        rootPath={ROOT}
        status={status({
          branch: 'main',
          upstreamDistance: { kind: 'known', ahead: 2, behind: 3 },
          workingTree: {
            kind: 'known',
            staged: 0,
            unstaged: 4,
            untracked: 0,
            unmerged: 0,
            changed: 4,
          },
        })}
      />,
    );

    expect(screen.getByText('main')).toBeDefined();
    expect(screen.getByText('3 to pull')).toBeDefined();
    expect(screen.getByText('2 to push')).toBeDefined();
    expect(screen.getByText('4 uncommitted')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open main in editor' })).toBeDefined();
  });

  it('reports a clean checkout when nothing diverges', () => {
    render(<WorkspaceGitPanel rootPath={ROOT} status={status({})} />);

    expect(screen.getByText('In sync and clean')).toBeDefined();
    expect(screen.queryByText(/to pull/)).toBeNull();
  });

  it('never claims a checkout is in sync when the read failed', () => {
    render(
      <WorkspaceGitPanel
        rootPath={ROOT}
        status={status({
          upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
          workingTree: { kind: 'unknown', reason: 'status-read-failed' },
        })}
      />,
    );

    expect(screen.queryByText('In sync and clean')).toBeNull();
    expect(screen.getByText('Goodboy cannot read this checkout')).toBeDefined();
    expect(screen.getByText('git status could not be read')).toBeDefined();
  });

  it('counts a conflicted file as conflicted, never as staged and unstaged', () => {
    render(
      <WorkspaceGitPanel
        rootPath={ROOT}
        status={status({
          inProgress: 'merge',
          workingTree: {
            kind: 'known',
            staged: 0,
            unstaged: 0,
            untracked: 0,
            unmerged: 1,
            changed: 1,
          },
        })}
      />,
    );

    expect(screen.getByText('1 conflicted')).toBeDefined();
    expect(screen.getByText('a merge is in progress')).toBeDefined();
  });

  it('keeps the fast-forward control visible and disabled with a reason on a dirty tree', () => {
    render(
      <WorkspaceGitPanel
        rootPath={ROOT}
        status={status({
          upstreamDistance: { kind: 'known', ahead: 0, behind: 2 },
          workingTree: {
            kind: 'known',
            staged: 0,
            unstaged: 1,
            untracked: 0,
            unmerged: 0,
            changed: 1,
          },
        })}
      />,
    );

    const control = screen.getByRole('button', { name: /Fast-forward main to origin\/main/ });

    expect(control.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('commit or stash the uncommitted changes first')).toBeDefined();
  });

  it('names the branch and upstream it will fast-forward, never main by default', () => {
    render(
      <WorkspaceGitPanel
        rootPath={ROOT}
        status={status({
          branch: 'ak/feature',
          upstream: 'origin/ak/feature',
          upstreamDistance: { kind: 'known', ahead: 0, behind: 3 },
        })}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Fast-forward ak\/feature to origin\/ak\/feature/ }),
    ).toBeDefined();
  });

  it('enables the fast-forward on a clean checkout behind its upstream and pulls the workspace', () => {
    render(
      <WorkspaceGitPanel
        rootPath={ROOT}
        status={status({ upstreamDistance: { kind: 'known', ahead: 0, behind: 2 } })}
      />,
    );

    const control = screen.getByRole('button', { name: /Fast-forward main to origin\/main/ });
    expect(control.hasAttribute('disabled')).toBe(false);

    fireEvent.click(control);

    expect(fastForwardSpy).toHaveBeenCalledTimes(1);
    expect(fastForwardSpy).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID });
  });

  it('refuses the fast-forward when the working tree is unreadable even if the distance is known', () => {
    render(
      <WorkspaceGitPanel
        rootPath={ROOT}
        status={status({
          upstreamDistance: { kind: 'known', ahead: 0, behind: 2 },
          workingTree: { kind: 'unknown', reason: 'status-read-failed' },
        })}
      />,
    );

    const control = screen.getByRole('button', { name: /Fast-forward main to origin\/main/ });

    expect(control.hasAttribute('disabled')).toBe(true);
    expect(control.getAttribute('title')).toBe('git status could not be read');

    fireEvent.click(control);

    expect(fastForwardSpy).not.toHaveBeenCalled();
  });

  it('refuses the fast-forward when the distance is unknown even if the tree is clean', () => {
    render(
      <WorkspaceGitPanel
        rootPath={ROOT}
        status={status({ upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' } })}
      />,
    );

    const control = screen.getByRole('button', { name: /Fast-forward main to origin\/main/ });

    expect(control.hasAttribute('disabled')).toBe(true);
    expect(control.getAttribute('title')).toBe(
      'git could not compare this branch with its upstream',
    );

    fireEvent.click(control);

    expect(fastForwardSpy).not.toHaveBeenCalled();
  });

  it('refuses the fast-forward while an operation is in progress', () => {
    render(
      <WorkspaceGitPanel
        rootPath={ROOT}
        status={status({
          inProgress: 'rebase',
          upstreamDistance: { kind: 'known', ahead: 0, behind: 2 },
        })}
      />,
    );

    const control = screen.getByRole('button', { name: /Fast-forward main to origin\/main/ });

    expect(control.hasAttribute('disabled')).toBe(true);
    expect(control.getAttribute('title')).toBe('finish the rebase in progress first');

    fireEvent.click(control);

    expect(fastForwardSpy).not.toHaveBeenCalled();
  });
});
