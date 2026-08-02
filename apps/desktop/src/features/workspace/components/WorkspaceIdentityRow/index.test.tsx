// @vitest-environment happy-dom

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
}));

import { WorkspaceIdentityRow } from './index';

afterEach(cleanup);

describe('WorkspaceIdentityRow', () => {
  it('carries the repo subtitle in the sidebar', () => {
    render(<WorkspaceIdentityRow variant="sidebar" />);

    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.getByText('monorepo')).toBeDefined();
  });

  it('drops the subtitle when it rides in the strip', () => {
    render(<WorkspaceIdentityRow variant="compact" />);

    expect(screen.getByText('Acme')).toBeDefined();
    expect(screen.queryByText('monorepo')).toBeNull();
  });

  it('keeps settings next to the identity it configures', () => {
    const spy = vi.fn();
    window.addEventListener('goodboy:open-workspace-settings', spy);
    render(<WorkspaceIdentityRow variant="compact" />);

    fireEvent.click(screen.getByLabelText(/open workspace settings for acme/i));
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-workspace-settings', spy);
  });

  it('renders nothing without a workspace', () => {
    workspaceRef.value = null;
    const { container } = render(<WorkspaceIdentityRow variant="sidebar" />);

    expect(container.firstChild).toBeNull();
    workspaceRef.value = {
      id: 'ws-1' as WorkspaceId,
      name: 'Acme',
      rootPath: '/code/monorepo',
    } as Workspace;
  });
});
