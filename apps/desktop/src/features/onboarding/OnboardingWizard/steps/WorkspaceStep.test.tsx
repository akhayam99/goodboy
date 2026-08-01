// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';

vi.mock('../../../workspace/components/WorkspaceLinkForm', () => ({
  WorkspaceLinkForm: ({
    onCancel,
    cancelLabel,
    modes,
  }: {
    onCancel: () => void;
    cancelLabel: string;
    modes: ReadonlyArray<string>;
  }) => (
    <div data-testid="workspace-link-form" data-modes={modes.join(',')}>
      <button onClick={onCancel}>{cancelLabel}</button>
    </div>
  ),
}));

import { WorkspaceStep } from './WorkspaceStep';

const REPOSITORY_WORKSPACE = {
  id: 'workspace-1' as WorkspaceId,
  name: 'Goodboy desktop',
  rootPath: '/Users/dev/goodboy',
  createdAt: '2026-08-02T08:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-08-02T08:00:00.000Z' as IsoDateTime,
} satisfies Workspace;

afterEach(cleanup);

describe('WorkspaceStep', () => {
  it('asks how the user works before showing any workspace form', () => {
    const onAddWorkspace = vi.fn();
    window.addEventListener('goodboy:add-workspace', onAddWorkspace);
    render(<WorkspaceStep workspace={null} />);

    expect(screen.getByRole('heading', { name: 'How do you work?' })).toBeDefined();
    expect(screen.queryByTestId('workspace-link-form')).toBeNull();
    expect(onAddWorkspace).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:add-workspace', onAddWorkspace);
  });

  it('offers the repository paths to a developer', () => {
    render(<WorkspaceStep workspace={null} />);

    fireEvent.click(screen.getByRole('button', { name: /I write code/ }));

    expect(screen.getByRole('heading', { name: 'Add workspace' })).toBeDefined();
    expect(screen.getByTestId('workspace-link-form').getAttribute('data-modes')).toBe(
      'single,multi',
    );
  });

  it('sends everyone else straight to the standalone path', () => {
    render(<WorkspaceStep workspace={null} />);

    fireEvent.click(screen.getByRole('button', { name: /I do not write code/ }));

    expect(screen.getByTestId('workspace-link-form').getAttribute('data-modes')).toBe('simple');
  });

  it('goes back to the question from the form', () => {
    render(<WorkspaceStep workspace={null} />);

    fireEvent.click(screen.getByRole('button', { name: /I write code/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('heading', { name: 'How do you work?' })).toBeDefined();
    expect(screen.queryByTestId('workspace-link-form')).toBeNull();
  });

  it('shows the connected repository name, path, and normalized kind', () => {
    render(<WorkspaceStep workspace={REPOSITORY_WORKSPACE} />);

    expect(screen.getByRole('heading', { name: 'Workspace connected' })).toBeDefined();
    expect(screen.getByText('Goodboy desktop')).toBeDefined();
    expect(screen.getByText('/Users/dev/goodboy')).toBeDefined();
    expect(screen.getByText('Repository')).toBeDefined();
  });

  it('treats an explicit repo kind the same as an undefined kind', () => {
    const { rerender } = render(<WorkspaceStep workspace={REPOSITORY_WORKSPACE} />);
    expect(screen.getByText('Repository')).toBeDefined();

    rerender(<WorkspaceStep workspace={{ ...REPOSITORY_WORKSPACE, kind: 'repo' }} />);

    expect(screen.getByText('Repository')).toBeDefined();
  });

  it('shows the standalone kind and lets the user change the workspace inline', () => {
    render(<WorkspaceStep workspace={{ ...REPOSITORY_WORKSPACE, kind: 'simple' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change workspace' }));

    expect(screen.getByRole('heading', { name: 'How do you work?' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Standalone')).toBeDefined();
  });
});
