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

type Overrides = {
  readonly hasActiveSession?: boolean;
  readonly isSessionSidebarCollapsed?: boolean;
  readonly onToggleSessionSidebar?: () => void;
  readonly onSessionSidebarAnchorEnter?: () => void;
  readonly onSessionSidebarAnchorLeave?: () => void;
};

const renderHeader = (overrides: Overrides = {}) =>
  render(
    <WorkspaceHeader
      hasActiveSession={overrides.hasActiveSession ?? false}
      isSessionSidebarCollapsed={overrides.isSessionSidebarCollapsed ?? false}
      onToggleSessionSidebar={overrides.onToggleSessionSidebar ?? vi.fn()}
      onSessionSidebarAnchorEnter={overrides.onSessionSidebarAnchorEnter ?? vi.fn()}
      onSessionSidebarAnchorLeave={overrides.onSessionSidebarAnchorLeave ?? vi.fn()}
    />,
  );

const anchor = () => screen.queryByRole('button', { name: /sessions column \(⌘B\)/i });

beforeEach(() => {
  state.currentWorkspace = { id: 'ws-a', name: 'alpha', rootPath: '/code/alpha-app' } as Workspace;
  state.sessions = [];
  state.unreadElsewhere = false;
});
afterEach(cleanup);

describe('WorkspaceHeader', () => {
  it('renders the current workspace name', () => {
    renderHeader();
    expect(screen.getByText('alpha')).toBeDefined();
  });

  it('opens the switcher via the global event', () => {
    const spy = vi.fn();
    window.addEventListener('goodboy:open-workspace-switcher', spy);
    renderHeader();
    fireEvent.click(screen.getByLabelText(/switch or open a workspace/i));
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-workspace-switcher', spy);
  });

  it('renders nothing without a current workspace', () => {
    state.currentWorkspace = null;
    const { container } = renderHeader();
    expect(container.firstChild).toBeNull();
  });

  it('dispatches the workspace settings event when the gear is clicked', () => {
    const spy = vi.fn();
    window.addEventListener(SETTINGS_EVENT, spy);
    renderHeader();
    fireEvent.click(screen.getByLabelText(/open workspace settings for alpha/i));
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener(SETTINGS_EVENT, spy);
  });

  it('holds no sidebar control on the board, where there is no column', () => {
    renderHeader({ hasActiveSession: false, isSessionSidebarCollapsed: true });
    expect(anchor()).toBeNull();
  });

  it('owns the only column control, in both directions', () => {
    const onToggleSessionSidebar = vi.fn();
    const { rerender } = renderHeader({
      hasActiveSession: true,
      isSessionSidebarCollapsed: false,
      onToggleSessionSidebar,
    });
    expect(screen.getByRole('button', { name: /hide sessions column \(⌘B\)/i })).toBeDefined();

    rerender(
      <WorkspaceHeader
        hasActiveSession
        isSessionSidebarCollapsed
        onToggleSessionSidebar={onToggleSessionSidebar}
        onSessionSidebarAnchorEnter={vi.fn()}
        onSessionSidebarAnchorLeave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show sessions column \(⌘B\)/i }));
    expect(onToggleSessionSidebar).toHaveBeenCalledOnce();
  });

  it('asks for a peek when the pointer rests on the anchor', () => {
    const onSessionSidebarAnchorEnter = vi.fn();
    const onSessionSidebarAnchorLeave = vi.fn();
    renderHeader({
      hasActiveSession: true,
      isSessionSidebarCollapsed: true,
      onSessionSidebarAnchorEnter,
      onSessionSidebarAnchorLeave,
    });
    const button = anchor() as HTMLElement;

    fireEvent.pointerEnter(button);
    expect(onSessionSidebarAnchorEnter).toHaveBeenCalledOnce();

    fireEvent.pointerLeave(button);
    expect(onSessionSidebarAnchorLeave).toHaveBeenCalledOnce();
  });
});
