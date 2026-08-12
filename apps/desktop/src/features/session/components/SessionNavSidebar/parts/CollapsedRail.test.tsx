import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    activeLens: {} as Record<string, string | null>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionBranches: {} as Record<string, string | undefined>,
    workspaces: [{ id: 'ws-1', kind: 'repo', name: 'Acme', rootPath: '/code/acme' }],
    openWorkspace: vi.fn(),
    setCurrentSession: vi.fn(),
    setActiveLens: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useCurrentWorkspace: () => state.workspaces[0],
  useWorkspaces: () => state.workspaces,
  useWorkspaceHasUnread: () => false,
  EMPTY_ARRAY: [] as never[],
}));

afterEach(() => {
  cleanup();
  state.activeLens = {};
  state.setCurrentSession.mockClear();
  state.setActiveLens.mockClear();
});

import { CollapsedRail } from './CollapsedRail';

const session = {
  id: 'session-1' as SessionId,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'ship the rail',
} as Session;

describe('CollapsedRail', () => {
  it('keeps expand, board and new session reachable without labels', () => {
    const onExpand = vi.fn();
    render(<CollapsedRail session={session} onExpand={onExpand} />);

    fireEvent.click(screen.getByRole('button', { name: /show session sidebar/i }));
    expect(onExpand).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: /back to board/i }));
    expect(state.setCurrentSession).toHaveBeenCalledWith(null);

    const spy = vi.fn();
    window.addEventListener('goodboy:new-session', spy);
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:new-session', spy);
  });

  it('keeps the workspace switcher reachable from the rail badge', () => {
    render(<CollapsedRail session={session} onExpand={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /switch workspace/i }));

    expect(screen.getByText('New workspace')).toBeDefined();
  });

  it('answers the global switcher shortcut while collapsed', () => {
    render(<CollapsedRail session={session} onExpand={vi.fn()} />);

    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
    });

    expect(screen.getByText('New workspace')).toBeDefined();
  });

  it('switches lens from the rail without expanding it', () => {
    render(<CollapsedRail session={session} onExpand={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^questions/i }));

    expect(state.setActiveLens).toHaveBeenCalledWith('session-1', 'questions');
  });

  it('marks the current lens on the rail', () => {
    state.activeLens = { 'session-1': 'plans' };
    render(<CollapsedRail session={session} onExpand={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^plans/i }).getAttribute('aria-current')).toBe(
      'page',
    );
  });
});
