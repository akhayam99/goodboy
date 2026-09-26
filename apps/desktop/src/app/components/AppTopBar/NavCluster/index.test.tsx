// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

const SESSION_ID = 'session-1' as SessionId;

const { store } = vi.hoisted(() => ({
  store: {
    currentWorkspaceId: 'ws-1',
    currentSessionId: null as string | null,
    appStudio: null as { readonly kind: string } | null,
    sessions: [] as ReadonlyArray<Session>,
    navigation: {} as Record<string, unknown>,
    back: vi.fn(),
    forward: vi.fn(),
    goToHistory: vi.fn(),
    navigate: vi.fn(),
    closeStudio: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  BOARD_PLACE: { at: 'board' },
  useAppStore: Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
  }),
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    Tooltip: ({ content, children }: { content: string; children: React.ReactNode }) => (
      <span data-tooltip={content}>{children}</span>
    ),
  };
});

import { NavCluster } from './index';

const sessionView = (lens: string | null) => ({
  workspaceId: 'ws-1',
  place: {
    at: 'session',
    sessionId: SESSION_ID,
    view: { lens, agentId: null, studio: null, target: null },
  },
  studio: null,
  focus: { drawer: null, selection: {}, scroll: {}, revealed: [] },
});

const BOARD_ENTRY = {
  workspaceId: 'ws-1',
  place: { at: 'board' },
  studio: null,
  focus: { drawer: null, selection: {}, scroll: {}, revealed: [] },
};

beforeEach(() => {
  store.currentSessionId = null;
  store.appStudio = null;
  store.navigation = {};
  store.sessions = [{ id: SESSION_ID, goal: 'Retry failed webhook deliveries' } as Session];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NavCluster', () => {
  it('shows Board with its word, current and inert on the board', () => {
    render(<NavCluster />);

    const board = screen.getByRole('button', { name: 'Board' });
    expect(board.textContent).toContain('Board');
    expect(board.getAttribute('aria-current')).toBe('page');
    expect(board.parentElement?.getAttribute('data-tooltip')).toBe("You're on the board");
    fireEvent.click(board);
    expect(store.navigate).not.toHaveBeenCalled();
    expect(store.closeStudio).not.toHaveBeenCalled();
  });

  it('closes a studio over the board and names it in the tooltip', () => {
    store.appStudio = { kind: 'settings' };
    render(<NavCluster />);

    const board = screen.getByRole('button', { name: 'Board' });
    expect(board.getAttribute('aria-current')).toBeNull();
    expect(board.parentElement?.getAttribute('data-tooltip')).toContain('Close Settings');
    fireEvent.click(board);
    expect(store.closeStudio).toHaveBeenCalledOnce();
  });

  it('goes to the board from a session as a history move', () => {
    store.currentSessionId = SESSION_ID;
    render(<NavCluster />);

    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(store.navigate).toHaveBeenCalledWith({ to: { at: 'board' } });
  });

  it('disables Back with nothing behind, and names the destination when there is one', () => {
    render(<NavCluster />);
    const back = screen.getByRole('button', { name: 'Back' });
    expect(back.getAttribute('aria-disabled')).toBe('true');
    expect(back.parentElement?.getAttribute('data-tooltip')).toBe('Nothing to go back to');
    fireEvent.click(back);
    expect(store.back).not.toHaveBeenCalled();

    cleanup();
    store.navigation = { 'ws-1': { entries: [sessionView('review'), BOARD_ENTRY], index: 1 } };
    render(<NavCluster />);
    const live = screen.getByRole('button', { name: 'Back to Review' });
    expect(live.parentElement?.getAttribute('data-tooltip')).toContain(
      'Back to Review · Retry failed webhook deliveries',
    );
    fireEvent.click(live);
    expect(store.back).toHaveBeenCalledOnce();
  });

  it('opens the recent history on right click and jumps to an entry', () => {
    store.navigation = {
      'ws-1': { entries: [sessionView(null), sessionView('review'), BOARD_ENTRY], index: 2 },
    };
    render(<NavCluster />);

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Back to Review' }));
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual([
      'Board',
      'ReviewRetry failed webhook deliveries',
      'OverviewRetry failed webhook deliveries',
    ]);
    expect(items[0]?.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(items[2] as HTMLElement);
    expect(store.goToHistory).toHaveBeenCalledWith({ index: 0 });
  });
});
