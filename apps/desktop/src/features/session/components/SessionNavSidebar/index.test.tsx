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

vi.mock('../../hooks/useLensNavModel', () => ({
  useLensNavModel: () => ({
    isBranchless: false,
    filesCount: 0,
    diffstat: { additions: 0, deletions: 0 },
  }),
}));

vi.mock('./parts/LensNav', () => ({ LensNav: () => <div data-testid="lens-nav" /> }));

afterEach(cleanup);

import { SessionNavSidebar } from './index';

const session = { id: 'session-1' as SessionId, goal: 'ship the nav' } as Session;

describe('SessionNavSidebar', () => {
  it('uses the session title as the back affordance in lens mode', () => {
    const onModeChange = vi.fn();
    render(<SessionNavSidebar session={session} mode="lenses" onModeChange={onModeChange} />);

    expect(screen.getByTestId('lens-nav')).toBeTruthy();
    expect(screen.queryByTestId('activity-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to sessions' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ship the nav' }));
    expect(onModeChange).toHaveBeenCalledWith('sessions');
  });

  it('keeps the board CTA reachable from both modes', () => {
    render(<SessionNavSidebar session={session} mode="lenses" onModeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /back to board/i }));
    expect(state.setCurrentSession).toHaveBeenCalledWith(null);

    cleanup();
    state.setCurrentSession.mockClear();

    render(<SessionNavSidebar session={session} mode="sessions" onModeChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /back to board/i }));
    expect(state.setCurrentSession).toHaveBeenCalledWith(null);
  });

  it('drops the workspace name row in sessions mode', () => {
    render(<SessionNavSidebar session={session} mode="sessions" onModeChange={vi.fn()} />);

    expect(screen.getByTestId('activity-bar')).toBeTruthy();
    expect(screen.queryByTestId('lens-nav')).toBeNull();
    expect(screen.queryByText('Test WS')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('steps the pane forward into detail and back out to the list', () => {
    const { container, rerender } = render(
      <SessionNavSidebar session={session} mode="sessions" onModeChange={vi.fn()} />,
    );
    const listPane = container.querySelector('.motion-safe\\:animate-nav-step-out');
    expect(listPane?.contains(screen.getByTestId('activity-bar'))).toBe(true);

    rerender(<SessionNavSidebar session={session} mode="lenses" onModeChange={vi.fn()} />);
    const detailPane = container.querySelector('.motion-safe\\:animate-nav-step-in');
    expect(detailPane?.contains(screen.getByTestId('lens-nav'))).toBe(true);
    expect(container.querySelector('.motion-safe\\:animate-nav-step-out')).toBeNull();
  });

  it('carries workspace identity and the collapse control in the pinned header', () => {
    const onCollapse = vi.fn();
    render(
      <SessionNavSidebar
        session={session}
        mode="lenses"
        onModeChange={vi.fn()}
        onCollapse={onCollapse}
      />,
    );

    expect(screen.getByLabelText('Switch or open a workspace')).toBeTruthy();
    expect(screen.getByLabelText('Preferences')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /hide session sidebar/i }));
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it('drops the header in the peek panel, where collapsing makes no sense', () => {
    render(<SessionNavSidebar session={session} mode="lenses" onModeChange={vi.fn()} />);

    expect(screen.queryByLabelText('Switch or open a workspace')).toBeNull();
    expect(screen.queryByRole('button', { name: /hide session sidebar/i })).toBeNull();
  });

  it('returns to lens mode and closes the peek once a session is picked', () => {
    const onModeChange = vi.fn();
    const onNavigate = vi.fn();
    render(
      <SessionNavSidebar
        session={session}
        mode="sessions"
        onModeChange={onModeChange}
        onNavigate={onNavigate}
      />,
    );

    activityBar.onSelectSession('session-2' as SessionId);
    expect(state.setCurrentSession).toHaveBeenCalledWith('session-2');
    expect(onModeChange).toHaveBeenCalledWith('lenses');
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
