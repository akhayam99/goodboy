// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  ChatId,
  ChatSessionLink,
  ChatSessionLinkId,
  ChatSummary,
  IsoDateTime,
  Session,
  WorkspaceId,
} from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    chatStreams: {} as Record<string, unknown>,
    unreadChatIds: [] as ReadonlyArray<string>,
    chatLinks: {} as Record<string, ReadonlyArray<unknown>>,
    sessions: [] as ReadonlyArray<unknown>,
    stages: {} as Record<string, string>,
    archivedChatsByWorkspace: {} as Record<string, ReadonlyArray<unknown>>,
    loadArchivedChats: vi.fn(async () => [] as ReadonlyArray<unknown>),
    deleteChats: vi.fn(async () => undefined),
    renameChat: vi.fn(async () => undefined),
    markChatUnread: vi.fn(),
    markChatRead: vi.fn(),
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
  useSessionStages: () => store.stages,
}));

vi.mock('../../../actions/components/ObjectOverflowMenu', async () => {
  const { useState } = await import('react');
  const { CHAT_KIND } = await import('../../../actions/kinds/chat');
  const { resolveActions } = await import('../../../actions/resolveActions');
  return {
    ObjectOverflowMenu: ({
      target,
      label,
      anchorKey,
    }: {
      readonly target: { readonly kind: 'chat'; readonly facts: ChatFacts };
      readonly label: string;
      readonly anchorKey: string;
    }) => {
      const [open, setOpen] = useState(false);
      const [confirming, setConfirming] = useState<string | null>(null);
      const actions = resolveActions({ definitions: CHAT_KIND.actions, facts: target.facts });
      const env = { anchorKey, origin: 'overflow', getState: () => store } as never;
      const run = (id: string) => {
        setOpen(false);
        setConfirming(null);
        void CHAT_KIND.actions
          .find((action) => action.id === id)
          ?.run({ facts: target.facts, env, choice: null });
      };
      const pending = actions.find((action) => action.id === confirming);
      return (
        <span>
          <button type="button" aria-label={label} onClick={() => setOpen(!open)} />
          {open
            ? actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    action.confirm === null ? run(action.id) : setConfirming(action.id)
                  }
                >
                  {action.label}
                </button>
              ))
            : null}
          {pending?.confirm === undefined || pending.confirm === null ? null : (
            <div role="group" aria-label={pending.confirm.title}>
              <p>{pending.confirm.title}</p>
              <button type="button" onClick={() => run(pending.id)}>
                {pending.confirm.confirmLabel}
              </button>
              <button type="button" onClick={() => run(pending.confirm?.altActionId ?? '')}>
                Archive instead
              </button>
            </div>
          )}
        </span>
      );
    },
  };
});

import type { ChatFacts } from '../../../actions/kinds/chat';
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
    effort: null,
    pinnedAt: isPinned ? at : null,
    archivedAt: null,
    lastActivityAt: at,
    createdAt: at,
    updatedAt: at,
    preview: `**Answer for ${title}**`,
    modelsUsed: [],
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
  const onDeleted = vi.fn();
  render(
    <ChatList
      workspaceId={WORKSPACE_ID}
      chats={CHATS}
      selectedId={null}
      onSelect={onSelect}
      onNew={vi.fn()}
      onArchived={onArchived}
      onDeleted={onDeleted}
    />,
  );
  return { onSelect, onArchived, onDeleted };
};

const titlesIn = (group: string): ReadonlyArray<string> =>
  within(screen.getByRole('region', { name: group }))
    .getAllByRole('button', { name: /^(?!Pin |Unpin |Archive |More actions)/ })
    .map((button) => button.getAttribute('aria-label') ?? '')
    .filter((label) => label !== 'Archive idle');

beforeEach(() => {
  store.chatStreams = {};
  store.unreadChatIds = [];
  store.chatLinks = {};
  store.sessions = [];
  store.stages = {};
  store.archivedChatsByWorkspace = {};
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

  describe('row menu', () => {
    const openMenu = (title: string) =>
      fireEvent.click(screen.getByRole('button', { name: `More actions for ${title}` }));

    it('opens from the more button with the five actions', () => {
      renderList();

      openMenu('Where is the consent step?');

      const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
      expect(items).toEqual(['Rename', 'Mark as unread', 'Pin', 'Archive', 'Delete']);
    });

    it('renames in place: Enter saves, Escape cancels', async () => {
      renderList();

      openMenu('Where is the consent step?');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
      const input = await screen.findByRole('textbox', { name: 'Rename chat' });
      fireEvent.change(input, { target: { value: 'Consent step' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(store.renameChat).toHaveBeenCalledWith({
        chatId: 'chat-consent',
        title: 'Consent step',
      });

      openMenu('What changed in payments-api');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
      const second = await screen.findByRole('textbox', { name: 'Rename chat' });
      fireEvent.keyDown(second, { key: 'Escape' });
      expect(store.renameChat).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('textbox', { name: 'Rename chat' })).toBeNull();
    });

    it('marks a chat as unread', () => {
      renderList();

      openMenu('Lunch ideas near the office');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Mark as unread' }));

      expect(store.markChatUnread).toHaveBeenCalledWith({ chatId: 'chat-lunch' });
    });

    it('asks before deleting and leaves the sessions alone', async () => {
      const { onDeleted } = renderList();

      openMenu('Lunch ideas near the office');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      expect(screen.getByText('Delete chat?')).toBeDefined();
      expect(store.deleteChats).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() =>
        expect(store.deleteChats).toHaveBeenCalledWith({
          workspaceId: WORKSPACE_ID,
          chatIds: ['chat-lunch'],
        }),
      );
      expect(onDeleted).toHaveBeenCalledWith(['chat-lunch']);
    });

    it('offers Archive instead in the delete confirm', () => {
      const { onArchived } = renderList();

      openMenu('Lunch ideas near the office');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      fireEvent.click(screen.getByRole('button', { name: 'Archive instead' }));

      expect(store.archiveChats).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        chatIds: ['chat-lunch'],
      });
      expect(onArchived).toHaveBeenCalledWith(['chat-lunch']);
      expect(store.deleteChats).not.toHaveBeenCalled();
    });
  });

  describe('archived view', () => {
    const archivedOf = (key: string, title: string): ChatSummary => ({
      ...chatOf({ key, title, ageMs: 3 * DAY }),
      archivedAt: new Date(Date.now() - DAY).toISOString() as IsoDateTime,
    });

    beforeEach(() => {
      store.archivedChatsByWorkspace = {
        [WORKSPACE_ID]: [
          archivedOf('invoice', 'Northwind invoice export format'),
          archivedOf('sign', 'Acme webhook signing'),
        ],
      };
    });

    it('shows the Archived row only when something is archived', () => {
      store.archivedChatsByWorkspace = {};
      renderList();

      expect(screen.queryByText(/Archived ·/)).toBeNull();
    });

    it('switches the rail to the archived chats and back', () => {
      renderList();

      fireEvent.click(screen.getByRole('button', { name: /Archived · 2/ }));
      expect(screen.getByRole('button', { name: 'Northwind invoice export format' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'New chat' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Chats' }));
      expect(screen.getByRole('button', { name: 'New chat' })).toBeDefined();
    });

    it('restores one chat', () => {
      renderList();

      fireEvent.click(screen.getByRole('button', { name: /Archived · 2/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Restore Acme webhook signing' }));

      expect(store.restoreChats).toHaveBeenCalledWith({
        workspaceId: WORKSPACE_ID,
        chatIds: ['chat-sign'],
      });
    });

    it('deletes one archived chat after a confirm without an archive option', async () => {
      const { onDeleted } = renderList();

      fireEvent.click(screen.getByRole('button', { name: /Archived · 2/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Acme webhook signing' }));
      expect(screen.queryByRole('button', { name: 'Archive instead' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() =>
        expect(store.deleteChats).toHaveBeenCalledWith({
          workspaceId: WORKSPACE_ID,
          chatIds: ['chat-sign'],
        }),
      );
      expect(onDeleted).toHaveBeenCalledWith(['chat-sign']);
    });

    it('deletes every archived chat after one inline confirm', async () => {
      renderList();

      fireEvent.click(screen.getByRole('button', { name: /Archived · 2/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete all archived' }));
      expect(screen.getByText('Delete 2 chats for good?')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Delete 2' }));

      await waitFor(() =>
        expect(store.deleteChats).toHaveBeenCalledWith({
          workspaceId: WORKSPACE_ID,
          chatIds: ['chat-invoice', 'chat-sign'],
        }),
      );
    });

    it('searches the archived chats', () => {
      renderList();

      fireEvent.click(screen.getByRole('button', { name: /Archived · 2/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Search archived' }), {
        target: { value: 'webhook' },
      });

      expect(screen.queryByRole('button', { name: 'Northwind invoice export format' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Acme webhook signing' })).toBeDefined();
    });
  });

  describe('session marker', () => {
    const linkOf = (chatKey: string, sessionId: string): ChatSessionLink => ({
      id: `link-${chatKey}-${sessionId}` as ChatSessionLinkId,
      chatId: `chat-${chatKey}` as ChatId,
      sessionId: sessionId as ChatSessionLink['sessionId'],
      messageId: null,
      kind: 'new',
      createdAt: new Date().toISOString() as IsoDateTime,
    });
    const sessionOf = (id: string, goal: string, deletedAt?: string): Session =>
      ({ id, goal, ...(deletedAt !== undefined && { deletedAt }) }) as unknown as Session;

    it('shows a session mark with the stage tone on a linked chat', () => {
      store.chatLinks = { 'chat-consent': [linkOf('consent', 's1')] };
      store.sessions = [sessionOf('s1', 'Ask for consent again')];
      store.stages = { s1: 'running' };
      renderList();

      const row = document.querySelector('[data-chat-row="chat-consent"]') as HTMLElement;
      expect(within(row).getByText('session')).toBeDefined();
      expect(row.querySelector('.bg-info')).not.toBeNull();
      const quiet = document.querySelector('[data-chat-row="chat-lunch"]') as HTMLElement;
      expect(within(quiet).queryByText('session')).toBeNull();
    });

    it('counts several sessions and takes the most urgent tone', () => {
      store.chatLinks = { 'chat-consent': [linkOf('consent', 's1'), linkOf('consent', 's2')] };
      store.sessions = [sessionOf('s1', 'One'), sessionOf('s2', 'Two')];
      store.stages = { s1: 'done', s2: 'attention' };
      renderList();

      const row = document.querySelector('[data-chat-row="chat-consent"]') as HTMLElement;
      expect(within(row).getByText('2 sessions')).toBeDefined();
      expect(row.querySelector('.bg-warning')).not.toBeNull();
    });

    it('ignores links to deleted or missing sessions', () => {
      store.chatLinks = { 'chat-consent': [linkOf('consent', 's1'), linkOf('consent', 's2')] };
      store.sessions = [sessionOf('s1', 'Gone', '2026-09-01T00:00:00.000Z')];
      renderList();

      const row = document.querySelector('[data-chat-row="chat-consent"]') as HTMLElement;
      expect(within(row).queryByText(/session/)).toBeNull();
    });
  });

  it('shows provider glyphs only when a chat used more than one model', () => {
    const mixed: ChatSummary = {
      ...(CHATS[2] as ChatSummary),
      modelsUsed: [
        { provider: 'anthropic', model: 'sonnet-5' },
        { provider: 'codex', model: 'gpt-5.6-sol' },
      ],
    };
    render(
      <ChatList
        workspaceId={WORKSPACE_ID}
        chats={[mixed, ...CHATS.slice(3)]}
        selectedId={null}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onArchived={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    const glyphs = (chatId: string) =>
      document.querySelectorAll(`[data-chat-row="${chatId}"] .text-meta svg`).length;
    expect(glyphs('chat-changes')).toBe(2);
    expect(glyphs('chat-lunch')).toBe(0);
  });
});
