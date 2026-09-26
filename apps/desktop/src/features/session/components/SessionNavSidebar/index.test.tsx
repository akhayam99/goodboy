import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId, Workspace, WorkspaceId } from '@goodboy/types';

const { state, currentWorkspace, activityBar } = vi.hoisted(() => ({
  state: {
    archivedSessions: {} as Record<string, ReadonlyArray<unknown>>,
    navigate: vi.fn(),
    loadArchivedSessions: vi.fn(),
    projects: [] as ReadonlyArray<never>,
  },
  currentWorkspace: {
    id: 'ws-1' as WorkspaceId,
    name: 'Test WS',
    slug: 'test-ws',
  } as Workspace,
  activityBar: { onSelectSession: vi.fn() as (id: SessionId) => void },
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
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
  state.navigate.mockClear();
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

  it('opens on the collapse control, with Board gone to the top bar', () => {
    const onToggle = vi.fn();
    render(<SessionNavSidebar session={session} onToggleSidebar={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /^Hide sessions/ }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /board/i })).toBeNull();
    expect(screen.queryByText('Sessions')).toBeNull();
    expect(screen.queryByLabelText(/switch workspace/i)).toBeNull();
    expect(screen.queryByLabelText('Preferences')).toBeNull();
  });

  it('closes the peek once a session is picked', () => {
    const onNavigate = vi.fn();
    render(<SessionNavSidebar session={session} onNavigate={onNavigate} />);

    activityBar.onSelectSession('session-2' as SessionId);
    expect(state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-2' as SessionId }),
    });
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
