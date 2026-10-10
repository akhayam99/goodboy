// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

const SESSION_ID = 'session-1' as SessionId;

const { store } = vi.hoisted(() => ({
  store: {
    currentWorkspaceId: 'ws-1',
    currentSessionId: null as string | null,
    openSessionDraftWorkspaceId: null as string | null,
    appStudio: null as { readonly kind: string } | null,
    sessions: [] as ReadonlyArray<Session>,
    navigation: {} as Record<string, unknown>,
    chatStreams: {} as Record<string, unknown>,
    chatsByWorkspace: {} as Record<
      string,
      ReadonlyArray<{ readonly id: string; readonly lastActivityAt: string }>
    >,
    lastChatByWorkspace: {} as Record<string, string | null>,
    unreadChatIds: [] as ReadonlyArray<string>,
    back: vi.fn(),
    forward: vi.fn(),
    goToHistory: vi.fn(),
    navigate: vi.fn(),
    closeStudio: vi.fn(),
    switchStudio: vi.fn(),
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
  store.openSessionDraftWorkspaceId = null;
  store.appStudio = null;
  store.navigation = {};
  store.chatStreams = {};
  store.chatsByWorkspace = {};
  store.lastChatByWorkspace = {};
  store.unreadChatIds = [];
  store.sessions = [{ id: SESSION_ID, goal: 'Retry failed webhook deliveries' } as Session];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NavCluster', () => {
  it('opens a new chat from the Chat button right of Board', () => {
    render(<NavCluster hasDoors />);

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.indexOf('Chat')).toBe(buttons.indexOf('Board') + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(store.switchStudio).toHaveBeenCalledWith({ studio: { kind: 'chat', chatId: null } });
  });

  it('opens the chat that was open last from the Chat button', () => {
    store.chatsByWorkspace = {
      'ws-1': [
        { id: 'chat-new', lastActivityAt: '2026-09-30T10:00:00.000Z' },
        { id: 'chat-old', lastActivityAt: '2026-09-29T10:00:00.000Z' },
      ],
    };
    store.lastChatByWorkspace = { 'ws-1': 'chat-old' };
    render(<NavCluster hasDoors />);

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));

    expect(store.switchStudio).toHaveBeenCalledWith({
      studio: { kind: 'chat', chatId: 'chat-old' },
    });
  });

  it('shows a pulsing dot and counts running chats on the Chat button', () => {
    store.chatStreams = { 'chat-1': {}, 'chat-2': {} };
    store.unreadChatIds = ['chat-3'];
    render(<NavCluster hasDoors />);

    const chat = screen.getByRole('button', { name: 'Chat' });
    expect(chat.getAttribute('data-chat-activity')).toBe('running');
    expect(chat.parentElement?.getAttribute('data-tooltip')).toBe('2 chats running');
    const dot = chat.querySelector('[class*="animate-soft-pulse"]');
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain('bg-info');
    expect(dot?.className).toContain('absolute');
  });

  it('names a single running chat', () => {
    store.chatStreams = { 'chat-1': {} };
    render(<NavCluster hasDoors />);

    const chat = screen.getByRole('button', { name: 'Chat' });
    expect(chat.parentElement?.getAttribute('data-tooltip')).toBe('1 chat running');
  });

  it('shows a still dot for a new reply once nothing is running', () => {
    store.unreadChatIds = ['chat-3'];
    render(<NavCluster hasDoors />);

    const chat = screen.getByRole('button', { name: 'Chat' });
    expect(chat.getAttribute('data-chat-activity')).toBe('unread');
    expect(chat.parentElement?.getAttribute('data-tooltip')).toBe('New reply');
    expect(chat.querySelector('[class*="animate-soft-pulse"]')).toBeNull();
    const dot = chat.querySelector('.rounded-full');
    expect(dot?.className).toContain('bg-warning');
    expect(dot?.className).not.toContain('bg-info');
    expect(dot?.className).toContain('absolute');
  });

  it('shows no dot when the chats are quiet', () => {
    render(<NavCluster hasDoors />);

    const chat = screen.getByRole('button', { name: 'Chat' });
    expect(chat.getAttribute('data-chat-activity')).toBeNull();
    expect(chat.querySelector('.rounded-full')).toBeNull();
  });

  it('marks Chat current while the chat studio is open', () => {
    store.appStudio = { kind: 'chat' };
    render(<NavCluster hasDoors />);

    const chat = screen.getByRole('button', { name: 'Chat' });
    expect(chat.getAttribute('aria-current')).toBe('page');
    fireEvent.click(chat);
    expect(store.switchStudio).not.toHaveBeenCalled();
  });

  it('shows Board with its word, current and inert on the board', () => {
    render(<NavCluster hasDoors />);

    const board = screen.getByRole('button', { name: 'Board' });
    expect(board.textContent).toContain('Board');
    expect(board.getAttribute('aria-current')).toBe('page');
    expect(board.parentElement?.getAttribute('data-tooltip')).toMatch(/^Board {2}\S+/);
    fireEvent.click(board);
    expect(store.navigate).not.toHaveBeenCalled();
    expect(store.closeStudio).not.toHaveBeenCalled();
  });

  it('closes a studio over the board and keeps the same word in the tooltip', () => {
    store.appStudio = { kind: 'settings' };
    render(<NavCluster hasDoors />);

    const board = screen.getByRole('button', { name: 'Board' });
    expect(board.getAttribute('aria-current')).toBeNull();
    expect(board.parentElement?.getAttribute('data-tooltip')).toMatch(/^Board {2}\S+/);
    fireEvent.click(board);
    expect(store.closeStudio).toHaveBeenCalledOnce();
  });

  it('goes to the board from a session as a history move', () => {
    store.currentSessionId = SESSION_ID;
    render(<NavCluster hasDoors />);

    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(store.navigate).toHaveBeenCalledWith({ to: { at: 'board' } });
  });

  it('goes to the board from the new session draft, where Board is not the current page', () => {
    store.openSessionDraftWorkspaceId = 'ws-1';
    render(<NavCluster hasDoors />);

    const board = screen.getByRole('button', { name: 'Board' });
    expect(board.getAttribute('aria-current')).toBeNull();
    expect(board.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(board);
    expect(store.navigate).toHaveBeenCalledWith({ to: { at: 'board' } });
    expect(store.closeStudio).not.toHaveBeenCalled();
  });

  it('disables Back with nothing behind, and names the destination when there is one', () => {
    render(<NavCluster hasDoors />);
    const back = screen.getByRole('button', { name: 'Back' });
    expect(back.getAttribute('aria-disabled')).toBe('true');
    expect(back.parentElement?.getAttribute('data-tooltip')).toBe('Nothing to go back to');
    fireEvent.click(back);
    expect(store.back).not.toHaveBeenCalled();

    cleanup();
    store.navigation = { 'ws-1': { entries: [sessionView('review'), BOARD_ENTRY], index: 1 } };
    render(<NavCluster hasDoors />);
    const live = screen.getByRole('button', { name: 'Back to Comments' });
    expect(live.parentElement?.getAttribute('data-tooltip')).toContain(
      'Back to Comments · Retry failed webhook deliveries',
    );
    fireEvent.click(live);
    expect(store.back).toHaveBeenCalledOnce();
  });

  it('opens the recent history on right click and jumps to an entry', () => {
    store.navigation = {
      'ws-1': { entries: [sessionView(null), sessionView('review'), BOARD_ENTRY], index: 2 },
    };
    render(<NavCluster hasDoors />);

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Back to Comments' }));
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual([
      'Board',
      'CommentsRetry failed webhook deliveries',
      'OverviewRetry failed webhook deliveries',
    ]);
    expect(items[0]?.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(items[2] as HTMLElement);
    expect(store.goToHistory).toHaveBeenCalledWith({ index: 0 });
  });
});
