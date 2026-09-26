import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    workspaces: [{ id: 'ws-1', kind: 'repo', name: 'Acme', rootPath: '/code/acme' }],
    openWorkspace: vi.fn(),
    navigate: vi.fn(),
  },
}));

vi.mock('../../../../../store', async () => ({
  ...(await import('../../../../../store/slices/navigation/place')),
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useCurrentWorkspace: () => state.workspaces[0],
  useWorkspaces: () => state.workspaces,
  useWorkspaceHasUnread: () => false,
  EMPTY_ARRAY: [] as never[],
}));

afterEach(() => {
  cleanup();
  state.navigate.mockClear();
});

import { CollapsedRail } from './CollapsedRail';

describe('CollapsedRail', () => {
  it('opens the sidebar from its first button and keeps new session, with no Board', () => {
    const onToggle = vi.fn();
    render(<CollapsedRail onToggleSidebar={onToggle} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]?.getAttribute('aria-label')).toMatch(/^Show sessions/);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /board/i })).toBeNull();

    const spy = vi.fn();
    window.addEventListener('goodboy:new-session', spy);
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:new-session', spy);
  });

  it('leaves the workspace switcher to the pinned top bar, holding no second copy', () => {
    render(<CollapsedRail />);

    expect(screen.queryByRole('button', { name: /switch workspace/i })).toBeNull();
  });

  it('answers no switcher shortcut of its own, so one popover owns the chord', () => {
    render(<CollapsedRail />);

    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
    });

    expect(screen.queryByText('Add workspace')).toBeNull();
  });

  it('offers no lens navigation, per the session-list-only sidebar', () => {
    render(<CollapsedRail onToggleSidebar={vi.fn()} />);

    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
