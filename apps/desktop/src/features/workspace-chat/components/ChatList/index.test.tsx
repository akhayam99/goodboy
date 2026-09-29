// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ChatId, ChatSummary, IsoDateTime, WorkspaceId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    chatStreams: {} as Record<string, unknown>,
    unreadChatIds: [] as ReadonlyArray<string>,
    archiveChats: vi.fn(async () => undefined),
    archiveIdleChats: vi.fn(async () => [] as ReadonlyArray<string>),
    restoreChats: vi.fn(async () => undefined),
    pinChat: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
  }),
}));

import { ChatList } from './index';

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type ChatSeed = {
  readonly key: string;
  readonly title: string;
  readonly ageMs: number;
  readonly isPinned?: boolean;
};

const chatOf = ({ key, title, ageMs, isPinned = false }: ChatSeed): ChatSummary => {
  const at = new Date(Date.now() - ageMs).toISOString() as IsoDateTime;
  return {
    id: `chat-${key}` as ChatId,
    workspaceId: WORKSPACE_ID,
    title,
    provider: 'anthropic',
    model: 'sonnet-5',
    pinnedAt: isPinned ? at : null,
    archivedAt: null,
    lastActivityAt: at,
    createdAt: at,
    updatedAt: at,
    preview: `**Answer for ${title}**`,
  };
};

const CHATS: ReadonlyArray<ChatSummary> = [
  chatOf({ key: 'release', title: 'Release checklist', ageMs: 5 * DAY, isPinned: true }),
  chatOf({ key: 'consent', title: 'Where is the consent step?', ageMs: 60_000 }),
  chatOf({ key: 'changes', title: 'What changed in payments-api', ageMs: 3 * DAY }),
  chatOf({ key: 'lunch', title: 'Lunch ideas near the office', ageMs: 9 * DAY }),
  chatOf({ key: 'flaky', title: 'Flaky test in ledger-core', ageMs: 21 * DAY }),
];

const renderList = () => {
  const onSelect = vi.fn();
  const onArchived = vi.fn();
  render(
    <ChatList
      workspaceId={WORKSPACE_ID}
      chats={CHATS}
      selectedId={null}
      onSelect={onSelect}
      onNew={vi.fn()}
      onArchived={onArchived}
    />,
  );
  return { onSelect, onArchived };
};

const titlesIn = (group: string): ReadonlyArray<string> =>
  within(screen.getByRole('region', { name: group }))
    .getAllByRole('button', { name: /^(?!Pin |Unpin |Archive )/ })
    .map((button) => button.getAttribute('aria-label') ?? '')
    .filter((label) => label !== 'Archive idle');

beforeEach(() => {
  store.chatStreams = {};
  store.unreadChatIds = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ChatList', () => {
  it('groups chats into Pinned, Today, This week and Idle', () => {
    renderList();

    expect(titlesIn('Pinned')).toEqual(['Release checklist']);
    expect(titlesIn('Today')).toEqual(['Where is the consent step?']);
    expect(titlesIn('This week')).toEqual(['What changed in payments-api']);
    expect(titlesIn('Idle')).toEqual(['Lunch ideas near the office', 'Flaky test in ledger-core']);
  });

  it('marks the row of a running chat and the row of a chat with a new reply', () => {
    store.chatStreams = { 'chat-consent': {} };
    store.unreadChatIds = ['chat-changes', 'chat-consent'];
    renderList();

    const running = document.querySelector('[data-chat-row="chat-consent"]');
    const answering = within(running as HTMLElement).getByRole('img', { name: 'Answering' });
    expect(answering.className).toContain('bg-info');
    expect(answering.className).toContain('animate-soft-pulse');
    expect(answering.className).toContain('absolute');
    expect(within(running as HTMLElement).queryByRole('img', { name: 'New reply' })).toBeNull();
    const unread = document.querySelector('[data-chat-row="chat-changes"]');
    const newReply = within(unread as HTMLElement).getByRole('img', { name: 'New reply' });
    expect(newReply.className).toContain('bg-warning');
    expect(newReply.className).not.toContain('animate-soft-pulse');
    expect(newReply.className).toContain('absolute');
    const quiet = document.querySelector('[data-chat-row="chat-lunch"]');
    expect(within(quiet as HTMLElement).queryByRole('img')).toBeNull();
  });

  it('keeps the dot in the row padding so the title never moves or sits under it', () => {
    store.chatStreams = { 'chat-consent': {} };
    store.unreadChatIds = ['chat-changes'];
    renderList();

    const dotOf = (chatId: string, name: string) =>
      within(document.querySelector(`[data-chat-row="${chatId}"]`) as HTMLElement).getByRole(
        'img',
        { name },
      );
    expect(dotOf('chat-consent', 'Answering').className).toContain('-left-3');
    expect(dotOf('chat-changes', 'New reply').className).toContain('-left-3');
    const rowPadding = (chatId: string) =>
      document.querySelector(`[data-chat-row="${chatId}"] .pl-4`)?.className ?? '';
    expect(rowPadding('chat-consent')).toContain('pl-4');
    expect(rowPadding('chat-lunch')).toContain('pl-4');
  });

  it('dims idle chats and shows how long they have been quiet', () => {
    renderList();

    const row = document.querySelector('[data-chat-row="chat-lunch"]');
    expect(row?.getAttribute('data-idle')).toBe('true');
    expect(row?.textContent).toContain('idle 9d');
  });

  it('archives the idle chats with an undo', async () => {
    store.archiveIdleChats.mockResolvedValueOnce(['chat-lunch', 'chat-flaky']);
    const { onArchived } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Archive idle' }));
    const undo = await screen.findByRole('button', { name: 'Undo' });
    expect(screen.getByText('2 idle chats archived')).toBeDefined();
    expect(onArchived).toHaveBeenCalledWith(['chat-lunch', 'chat-flaky']);

    fireEvent.click(undo);
    expect(store.restoreChats).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      chatIds: ['chat-lunch', 'chat-flaky'],
    });
  });

  it('filters by title and answer text', () => {
    renderList();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search chats' }), {
      target: { value: 'ledger' },
    });
    expect(screen.queryByRole('region', { name: 'Today' })).toBeNull();
    expect(titlesIn('Idle')).toEqual(['Flaky test in ledger-core']);
  });

  it('opens a chat when its row is clicked', () => {
    const { onSelect } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Where is the consent step?' }));
    expect(onSelect).toHaveBeenCalledWith('chat-consent');
  });
});
