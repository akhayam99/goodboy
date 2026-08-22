import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId, Workspace, WorkspaceId } from '@goodboy/types';

const { state, currentWorkspace, activityBar } = vi.hoisted(() => ({
  state: {
    archivedSessions: {} as Record<string, ReadonlyArray<unknown>>,
    setCurrentSession: vi.fn(),
    loadArchivedSessions: vi.fn(),
    projects: [] as ReadonlyArray<never>,
  },
  currentWorkspace: {
    id: 'ws-1' as WorkspaceId,
    name: 'Test WS',
    slug: 'test-ws',
    sessionsRoot: '/code/test-ws',
  } as Workspace,
  activityBar: { onSelectSession: vi.fn() as (id: SessionId) => void },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useCurrentWorkspace: () => currentWorkspace,
  useHasUnreadElsewhere: () => false,
  useSessions: () => [],
  EMPTY_ARRAY: [] as never[],
}));

vi.mock('../../../workspace/components/SessionActivityBar', () => ({
  SessionActivityBar: ({ onSelectSession }: { onSelectSession: (id: SessionId) => void }) => {
    activityBar.onSelectSession = onSelectSession;
    return <div data-testid="activity-bar" />;
  },
}));

afterEach(() => {
  cleanup();
  state.setCurrentSession.mockClear();
});

import { SessionNavSidebar } from './index';

const session = { id: 'session-1' as SessionId, goal: 'ship the nav' } as Session;

describe('SessionNavSidebar', () => {
  it('always renders the session list, with no lens navigation', () => {
    render(<SessionNavSidebar session={session} />);

    expect(screen.getByTestId('activity-bar')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: /lenses/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ship the nav' })).toBeNull();
  });

  it('keeps the board CTA reachable', () => {
    render(<SessionNavSidebar session={session} />);
    fireEvent.click(screen.getByRole('button', { name: /back to board/i }));
    expect(state.setCurrentSession).toHaveBeenCalledWith(null);
  });

  it('carries workspace identity and the collapse control in the pinned header', () => {
    const onCollapse = vi.fn();
    render(<SessionNavSidebar session={session} onCollapse={onCollapse} />);

    expect(screen.getByLabelText('Switch or open a workspace')).toBeTruthy();
    expect(screen.getByLabelText('Preferences')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /hide session sidebar/i }));
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it('drops the header in the peek panel, where collapsing makes no sense', () => {
    render(<SessionNavSidebar session={session} />);

    expect(screen.queryByLabelText('Switch or open a workspace')).toBeNull();
    expect(screen.queryByRole('button', { name: /hide session sidebar/i })).toBeNull();
  });

  it('closes the peek once a session is picked', () => {
    const onNavigate = vi.fn();
    render(<SessionNavSidebar session={session} onNavigate={onNavigate} />);

    activityBar.onSelectSession('session-2' as SessionId);
    expect(state.setCurrentSession).toHaveBeenCalledWith('session-2');
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
