// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceGitStatus } from '@goodboy/types';

const { openInEditorSpy, writeTextSpy, invokeSpy } = vi.hoisted(() => ({
  openInEditorSpy: vi.fn(async () => undefined),
  writeTextSpy: vi.fn(async () => undefined),
  invokeSpy: vi.fn(async () => undefined),
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openInEditor: openInEditorSpy,
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { WorkspaceGitPanel } from './index';

const ROOT = '/tmp/fresh-idea';

const status = (overrides: Partial<WorkspaceGitStatus>): WorkspaceGitStatus => ({
  state: 'ready',
  branch: 'main',
  headSubject: 'base',
  ahead: 0,
  behind: 0,
  staged: 0,
  unstaged: 0,
  untracked: 0,
  changed: 0,
  hasUpstream: true,
  ...overrides,
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

    expect(writeTextSpy).toHaveBeenCalledExactlyOnceWith(`git -C "${ROOT}" init -b main`);
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
        status={status({ branch: 'main', ahead: 2, behind: 3, changed: 4, unstaged: 4 })}
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
});
