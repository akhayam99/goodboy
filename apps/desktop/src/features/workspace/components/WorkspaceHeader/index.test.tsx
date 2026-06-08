// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, Workspace } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    currentWorkspace: null as Workspace | null,
    sessions: [] as ReadonlyArray<Session>,
    unreadElsewhere: false,
  },
}));

vi.mock('../../../../store', () => ({
  useCurrentWorkspace: () => state.currentWorkspace,
  useSessions: () => state.sessions,
  useHasUnreadElsewhere: () => state.unreadElsewhere,
}));

vi.mock('../WorkspaceSettingsDialog', () => ({
  WorkspaceSettingsDialog: () => <div data-testid="settings-dialog-mock" />,
}));

import { WorkspaceHeader } from './index';

beforeEach(() => {
  state.currentWorkspace = { id: 'ws-a', name: 'alpha', rootPath: '/code/alpha-app' } as Workspace;
  state.sessions = [];
  state.unreadElsewhere = false;
});
afterEach(cleanup);

describe('WorkspaceHeader', () => {
  it('renders the current workspace name', () => {
    render(<WorkspaceHeader />);
    expect(screen.getByText('alpha')).toBeDefined();
  });

  it('opens the switcher via the global event', () => {
    const spy = vi.fn();
    window.addEventListener('goodboy:open-workspace-switcher', spy);
    render(<WorkspaceHeader />);
    fireEvent.click(screen.getByLabelText(/switch or open a workspace/i));
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-workspace-switcher', spy);
  });

  it('renders nothing without a current workspace', () => {
    state.currentWorkspace = null;
    const { container } = render(<WorkspaceHeader />);
    expect(container.firstChild).toBeNull();
  });
});
