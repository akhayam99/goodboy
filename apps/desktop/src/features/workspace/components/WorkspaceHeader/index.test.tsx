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

import { WorkspaceHeader } from './index';

const SETTINGS_EVENT = 'goodboy:open-workspace-settings';

beforeEach(() => {
  state.currentWorkspace = { id: 'ws-a', name: 'alpha', rootPath: '/code/alpha-app' } as Workspace;
  state.sessions = [];
  state.unreadElsewhere = false;
});
afterEach(cleanup);

describe('WorkspaceHeader', () => {
  it('renders the current workspace name', () => {
    render(
      <WorkspaceHeader
        hasActiveSession={false}
        isSessionSidebarCollapsed={false}
        onToggleSessionSidebar={vi.fn()}
      />,
    );
    expect(screen.getByText('alpha')).toBeDefined();
  });

  it('opens the switcher via the global event', () => {
    const spy = vi.fn();
    window.addEventListener('goodboy:open-workspace-switcher', spy);
    render(
      <WorkspaceHeader
        hasActiveSession={false}
        isSessionSidebarCollapsed={false}
        onToggleSessionSidebar={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/switch or open a workspace/i));
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-workspace-switcher', spy);
  });

  it('renders nothing without a current workspace', () => {
    state.currentWorkspace = null;
    const { container } = render(
      <WorkspaceHeader
        hasActiveSession={false}
        isSessionSidebarCollapsed={false}
        onToggleSessionSidebar={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('dispatches the workspace settings event when the gear is clicked', () => {
    const spy = vi.fn();
    window.addEventListener(SETTINGS_EVENT, spy);
    render(
      <WorkspaceHeader
        hasActiveSession={false}
        isSessionSidebarCollapsed={false}
        onToggleSessionSidebar={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/open workspace settings for alpha/i));
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener(SETTINGS_EVENT, spy);
  });

  it('renders the sessions column toggle when a session is open', () => {
    const onToggleSessionSidebar = vi.fn();
    render(
      <WorkspaceHeader
        hasActiveSession
        isSessionSidebarCollapsed={false}
        onToggleSessionSidebar={onToggleSessionSidebar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /hide sessions column \(⌘B\)/i }));
    expect(onToggleSessionSidebar).toHaveBeenCalledOnce();
  });

  it('disables the sessions column toggle when no session is open', () => {
    render(
      <WorkspaceHeader
        hasActiveSession={false}
        isSessionSidebarCollapsed={false}
        onToggleSessionSidebar={vi.fn()}
      />,
    );
    expect(
      screen
        .getByRole('button', { name: /open a session to show the sessions column/i })
        .getAttribute('disabled'),
    ).not.toBeNull();
  });
});
