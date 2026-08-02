// @vitest-environment happy-dom

import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Workspace, WorkspaceId } from '@goodboy/types';

const { workspaceRef } = vi.hoisted(() => ({
  workspaceRef: {
    value: {
      id: 'ws-1' as WorkspaceId,
      name: 'Acme',
      rootPath: '/code/monorepo',
    } as Workspace | null,
  },
}));

vi.mock('../../../../store', () => ({
  useCurrentWorkspace: () => workspaceRef.value,
  useHasUnreadElsewhere: () => false,
  useWorkspaces: () => (workspaceRef.value ? [workspaceRef.value] : []),
  useWorkspaceHasUnread: () => false,
  useAppStore: (selector: (s: { openWorkspace: () => Promise<void> }) => unknown) =>
    selector({ openWorkspace: async () => undefined }),
}));

import { WorkspaceIdentityRow } from './index';

afterEach(cleanup);

describe('WorkspaceIdentityRow', () => {
  it('names the workspace and keeps the repo out of the strip', () => {
    render(<WorkspaceIdentityRow />);

    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.queryByText('monorepo')).toBeNull();
  });

  it('carries the repo in the switcher title', () => {
    render(<WorkspaceIdentityRow />);

    expect(screen.getByLabelText('Switch or open a workspace').getAttribute('title')).toBe(
      'Acme, monorepo',
    );
  });

  it('opens the selector as a popover, not a full-screen layer', () => {
    render(<WorkspaceIdentityRow />);
    const trigger = screen.getByLabelText('Switch or open a workspace');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Workspace settings')).toBeDefined();
  });

  it('answers the global switcher shortcut', () => {
    render(<WorkspaceIdentityRow />);

    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
    });

    expect(screen.getByText('Workspace settings')).toBeDefined();
  });

  it('renders nothing without a workspace', () => {
    workspaceRef.value = null;
    const { container } = render(<WorkspaceIdentityRow />);

    expect(container.firstChild).toBeNull();
    workspaceRef.value = {
      id: 'ws-1' as WorkspaceId,
      name: 'Acme',
      rootPath: '/code/monorepo',
    } as Workspace;
  });
});
