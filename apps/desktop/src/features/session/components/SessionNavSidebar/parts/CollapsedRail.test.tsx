import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    workspaces: [{ id: 'ws-1', kind: 'repo', name: 'Acme', rootPath: '/code/acme' }],
    openWorkspace: vi.fn(),
    setCurrentSession: vi.fn(),
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
  state.setCurrentSession.mockClear();
});

import { CollapsedRail } from './CollapsedRail';

describe('CollapsedRail', () => {
  it('keeps expand, board and new session reachable without labels', () => {
    const onExpand = vi.fn();
    render(<CollapsedRail onExpand={onExpand} />);

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
    render(<CollapsedRail onExpand={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /switch workspace/i }));

    expect(screen.getByText('New workspace')).toBeDefined();
  });

  it('answers the global switcher shortcut while collapsed', () => {
    render(<CollapsedRail onExpand={vi.fn()} />);

    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
    });

    expect(screen.getByText('New workspace')).toBeDefined();
  });

  it('offers no lens navigation, per the session-list-only sidebar', () => {
    render(<CollapsedRail onExpand={vi.fn()} />);

    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});
