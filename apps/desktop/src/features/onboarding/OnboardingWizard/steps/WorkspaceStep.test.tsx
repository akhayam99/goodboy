// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
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
  it('offers to add a workspace when none is connected', () => {
    const onAddWorkspace = vi.fn();
    window.addEventListener('goodboy:add-workspace', onAddWorkspace);
    render(<WorkspaceStep workspace={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add workspace' }));

    expect(screen.getByRole('heading', { name: 'Add workspace' })).toBeDefined();
    expect(onAddWorkspace).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:add-workspace', onAddWorkspace);
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

  it('shows the simple kind and lets the user change the workspace', () => {
    const onAddWorkspace = vi.fn();
    window.addEventListener('goodboy:add-workspace', onAddWorkspace);
    render(<WorkspaceStep workspace={{ ...REPOSITORY_WORKSPACE, kind: 'simple' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change workspace' }));

    expect(screen.getByText('Simple')).toBeDefined();
    expect(onAddWorkspace).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:add-workspace', onAddWorkspace);
  });
});
