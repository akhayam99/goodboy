// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  ChatId,
  ChatSessionLink,
  ChatSessionLinkId,
  ChatSessionLinkKind,
  ChatSummary,
  IsoDateTime,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

let useAppStore: StoryStore;
let ChatOriginRow: typeof import('./ChatOriginRow').ChatOriginRow;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ ChatOriginRow } = await import('./ChatOriginRow'));
}, STORE_IMPORT_TIMEOUT_MS);

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const SESSION_ID = 'session-duplicate-credit' as SessionId;
const NOW = '2026-09-28T09:00:00.000Z' as IsoDateTime;

const SESSION = aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID });

const chatOf = (id: string, title: string): ChatSummary => ({
  id: id as ChatId,
  workspaceId: WORKSPACE_ID,
  title,
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: null,
  pinnedAt: null,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  lastActivityAt: NOW,
  preview: null,
  modelsUsed: [],
  messageCount: 0,
});

const linkOf = (
  chatId: string,
  kind: ChatSessionLinkKind,
  sessionId = SESSION_ID,
): ChatSessionLink => ({
  id: `link-${chatId}-${kind}` as ChatSessionLinkId,
  chatId: chatId as ChatId,
  sessionId,
  messageId: null,
  kind,
  createdAt: NOW,
});

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    chatsByWorkspace: {
      [WORKSPACE_ID]: [
        chatOf('chat-retry', 'Payments retry design'),
        chatOf('chat-rounding', 'Ledger rounding'),
      ],
    },
    archivedChatsByWorkspace: { [WORKSPACE_ID]: [] },
    chatLinks: {},
  });
});

afterEach(cleanup);

describe('ChatOriginRow', () => {
  it('shows nothing for a session no chat touched', () => {
    useAppStore.setState({
      chatLinks: { ['chat-retry' as ChatId]: [linkOf('chat-retry', 'new', 'other' as SessionId)] },
    });
    render(<ChatOriginRow session={SESSION} />);

    expect(screen.queryByText(/From chat|Fed by chat/)).toBeNull();
  });

  it('names the chat that started the session on one line, without a dangling dot', () => {
    useAppStore.setState({
      chatLinks: { ['chat-retry' as ChatId]: [linkOf('chat-retry', 'new')] },
    });
    render(<ChatOriginRow session={SESSION} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('From chat: Payments retry design');
    expect(buttons[0]?.textContent).not.toMatch(/·/);
  });

  it('says Fed by chat only when no chat started the session', () => {
    useAppStore.setState({
      chatLinks: { ['chat-rounding' as ChatId]: [linkOf('chat-rounding', 'add')] },
    });
    render(<ChatOriginRow session={SESSION} />);

    expect(screen.getByRole('button').textContent).toBe('Fed by chat: Ledger rounding');
  });

  it('keeps the other chats in a popover behind +1 more', () => {
    useAppStore.setState({
      chatLinks: {
        ['chat-rounding' as ChatId]: [linkOf('chat-rounding', 'add')],
        ['chat-retry' as ChatId]: [linkOf('chat-retry', 'new')],
      },
    });
    render(<ChatOriginRow session={SESSION} />);

    expect(screen.queryByText(/Ledger rounding/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+1 more' }));
    const popover = screen.getByRole('dialog', { name: 'Other chats' });
    fireEvent.click(within(popover).getByRole('button', { name: 'Fed by chat: Ledger rounding' }));

    expect(useAppStore.getState().appStudio).toEqual({ kind: 'chat', chatId: 'chat-rounding' });
  });

  it('opens the chat from its line', () => {
    useAppStore.setState({
      chatLinks: { ['chat-retry' as ChatId]: [linkOf('chat-retry', 'new')] },
    });
    render(<ChatOriginRow session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: /Payments retry design/ }));

    const studio = useAppStore.getState().appStudio;
    expect(studio).toEqual({ kind: 'chat', chatId: 'chat-retry' });
  });
});
