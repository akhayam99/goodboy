// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';

const { store } = vi.hoisted(() => ({
  store: {
    chatsByWorkspace: {} as Record<string, ReadonlyArray<unknown>>,
    archivedChatsByWorkspace: {} as Record<string, ReadonlyArray<unknown>>,
    chatLinks: {} as Record<string, ReadonlyArray<unknown>>,
    loadChats: vi.fn(async () => undefined),
    loadArchivedChats: vi.fn(async () => []),
    openStudio: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

import { ChatOriginRow } from './ChatOriginRow';

const SESSION = aSession({
  id: 'session-consent' as SessionId,
  workspaceId: 'ws-harborline' as WorkspaceId,
});

const linkOf = (chatId: string, sessionId: string, createdAt: string, kind = 'new') => ({
  id: `link-${chatId}-${sessionId}`,
  chatId,
  sessionId,
  messageId: null,
  kind,
  createdAt,
});

beforeEach(() => {
  store.chatsByWorkspace = {
    'ws-harborline': [
      { id: 'chat-consent', title: 'Where is the consent step defined?' },
      { id: 'chat-other', title: 'Another chat' },
    ],
  };
  store.archivedChatsByWorkspace = { 'ws-harborline': [] };
  store.chatLinks = {};
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChatOriginRow', () => {
  it('shows nothing for a session no chat started', () => {
    store.chatLinks = { 'chat-other': [linkOf('chat-other', 'session-x', '2026-09-28T10:00:00Z')] };
    render(<ChatOriginRow session={SESSION} />);

    expect(screen.queryByText(/From chat/)).toBeNull();
  });

  it('shows nothing for a session a chat was only added to', () => {
    store.chatLinks = {
      'chat-consent': [linkOf('chat-consent', 'session-consent', '2026-09-28T10:00:00Z', 'add')],
    };
    render(<ChatOriginRow session={SESSION} />);

    expect(screen.queryByText(/From chat/)).toBeNull();
  });

  it('ignores a chat that was added later and names the one that started the session', () => {
    store.chatLinks = {
      'chat-other': [linkOf('chat-other', 'session-consent', '2026-09-28T09:00:00Z', 'add')],
      'chat-consent': [linkOf('chat-consent', 'session-consent', '2026-09-28T10:00:00Z')],
    };
    render(<ChatOriginRow session={SESSION} />);

    expect(screen.getByText('Where is the consent step defined?')).toBeDefined();
  });

  it('names the chat and opens it in the chat studio', () => {
    store.chatLinks = {
      'chat-consent': [linkOf('chat-consent', 'session-consent', '2026-09-28T10:00:00Z')],
    };
    render(<ChatOriginRow session={SESSION} />);

    expect(screen.getByText('Where is the consent step defined?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /From chat/ }));

    expect(store.openStudio).toHaveBeenCalledWith({
      studio: { kind: 'chat', chatId: 'chat-consent' },
    });
  });

  it('follows the first chat when several sent a brief to the session', () => {
    store.chatLinks = {
      'chat-other': [linkOf('chat-other', 'session-consent', '2026-09-28T12:00:00Z')],
      'chat-consent': [linkOf('chat-consent', 'session-consent', '2026-09-28T10:00:00Z')],
    };
    render(<ChatOriginRow session={SESSION} />);

    expect(screen.getByText('Where is the consent step defined?')).toBeDefined();
  });

  it('finds the chat among the archived ones and loads the chats that are missing', () => {
    store.chatsByWorkspace = {};
    store.archivedChatsByWorkspace = {
      'ws-harborline': [{ id: 'chat-consent', title: 'Archived consent chat' }],
    };
    store.chatLinks = {
      'chat-consent': [linkOf('chat-consent', 'session-consent', '2026-09-28T10:00:00Z')],
    };
    render(<ChatOriginRow session={SESSION} />);

    expect(screen.getByText('Archived consent chat')).toBeDefined();
    expect(store.loadChats).toHaveBeenCalledWith({ workspaceId: 'ws-harborline' });
    expect(store.loadArchivedChats).not.toHaveBeenCalled();
  });
});
