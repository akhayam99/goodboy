// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

const { holder } = vi.hoisted(() => ({ holder: { backend: null as ChatBackend | null } }));

vi.mock('../../activeChatBackend', () => ({
  activeChatBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  ChatId,
  ChatMessageId,
  ChatSessionLink,
  ChatSessionLinkId,
  ChatSummary,
  IsoDateTime,
  ProviderRunId,
  Session,
  SessionId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  CHAT_DAY,
  CHAT_WORKSPACE_ID,
  chatIdOf,
  newChatBackend,
  seedChats,
  type ChatSeed,
} from '../../../../__tests__/helpers/chatListFixtures';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ChatBackend } from '../../chatBackend';
import { chatModelLabel } from '../../chatModelLabel';
import { ageTokenOf } from './ageToken';
import { ChatList } from './index';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));

const MINUTE = 60_000;

const SEEDS: ReadonlyArray<ChatSeed> = [
  { key: 'release', title: 'Release checklist', ageMs: 5 * CHAT_DAY, isPinned: true },
  { key: 'consent', title: 'Where is the consent step?', ageMs: MINUTE },
  { key: 'changes', title: 'What changed in payments-api', ageMs: 3 * CHAT_DAY },
  { key: 'lunch', title: 'Lunch ideas near the office', ageMs: 9 * CHAT_DAY },
  { key: 'flaky', title: 'Flaky test in ledger-core', ageMs: 21 * CHAT_DAY },
];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const NONE: ReadonlyArray<ChatSummary> = [];

type HarnessProps = {
  readonly onSelect: (chatId: ChatId) => void;
  readonly onArchived: (chatIds: ReadonlyArray<ChatId>) => void;
  readonly onDeleted: (chatIds: ReadonlyArray<ChatId>) => void;
};

const Harness = ({ onSelect, onArchived, onDeleted }: HarnessProps) => {
  const chats = useAppStore((state) => state.chatsByWorkspace[CHAT_WORKSPACE_ID] ?? NONE);
  return (
    <ToastProvider>
      <ChatList
        workspaceId={CHAT_WORKSPACE_ID}
        chats={chats}
        selectedId={null}
        onSelect={onSelect}
        onNew={vi.fn()}
        onArchived={onArchived}
        onDeleted={onDeleted}
      />
    </ToastProvider>
  );
};

const renderList = async (seeds: ReadonlyArray<ChatSeed> = SEEDS) => {
  holder.backend = newChatBackend();
  await seedChats({ backend: holder.backend, seeds });
  await useAppStore.getState().loadChats({ workspaceId: CHAT_WORKSPACE_ID });
  const onSelect = vi.fn();
  const onArchived = vi.fn();
  const onDeleted = vi.fn();
  render(<Harness onSelect={onSelect} onArchived={onArchived} onDeleted={onDeleted} />);
  await act(async () => undefined);
  return { onSelect, onArchived, onDeleted };
};

const titlesIn = (group: string): ReadonlyArray<string> =>
  within(screen.getByRole('region', { name: group }))
    .getAllByRole('button', { name: /^(?!Pin |Unpin |Archive |Delete |More actions|Select )/ })
    .map((button) => button.getAttribute('aria-label') ?? '')
    .filter((label) => label !== 'Archive idle');

const rowOf = (key: string): HTMLElement =>
  document.querySelector(`[data-chat-row="${chatIdOf({ key })}"]`) as HTMLElement;

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ unreadChatIds: [], chatStreams: {}, chatLinks: {} });
});

afterEach(cleanup);

describe('ChatList', () => {
  it('groups chats into Pinned, Today, This week and Idle', async () => {
    await renderList();

    expect(titlesIn('Pinned')).toEqual(['Release checklist']);
    expect(titlesIn('Today')).toEqual(['Where is the consent step?']);
    expect(titlesIn('This week')).toEqual(['What changed in payments-api']);
    expect(titlesIn('Idle')).toEqual(['Lunch ideas near the office', 'Flaky test in ledger-core']);
  });

  it('marks the row of a running chat and the row of a chat with a new reply', async () => {
    await renderList();
    act(() =>
      useAppStore.setState({
        chatStreams: {
          [chatIdOf({ key: 'consent' })]: {
            runId: 'run-1' as ProviderRunId,
            messageId: 'message-1' as ChatMessageId,
            isStopping: false,
          },
        },
        unreadChatIds: [chatIdOf({ key: 'changes' }), chatIdOf({ key: 'consent' })],
      }),
    );

    expect(within(rowOf('consent')).getByRole('img', { name: 'Answering' })).toBeDefined();
    expect(within(rowOf('consent')).queryByRole('img', { name: 'New reply' })).toBeNull();
    expect(within(rowOf('changes')).getByRole('img', { name: 'New reply' })).toBeDefined();
    expect(within(rowOf('lunch')).queryByRole('img', { name: /Answering|New reply/ })).toBeNull();
  });

  it('dims idle chats and shows how long they have been quiet', async () => {
    await renderList();

    expect(rowOf('lunch').getAttribute('data-idle')).toBe('true');
    expect(rowOf('lunch').textContent?.replaceAll('\u00a0', ' ')).toContain('idle 9d');
  });

  it('keeps the age in one non-wrapping token', async () => {
    await renderList();

    const age = within(rowOf('lunch')).getByText('idle 9d');
    expect(age.textContent).toBe('idle\u00a09d');
    expect(age.textContent?.includes(' ')).toBe(false);
    expect(ageTokenOf({ time: 'idle 14d' })).toBe('idle\u00a014d');
    expect(ageTokenOf({ time: '09:41' })).toBe('09:41');
  });

  it('keeps the delete button out of the row at rest and shows it on hover and focus', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderList();
    const row = rowOf('lunch');
    const deleteName = 'Delete Lunch ideas near the office';

    expect(within(row).queryByRole('button', { name: deleteName })).toBeNull();

    await user.hover(row);
    expect(within(row).getByRole('button', { name: deleteName })).toBeDefined();

    await user.unhover(row);
    expect(within(row).queryByRole('button', { name: deleteName })).toBeNull();

    const opener = within(row).getByRole('button', { name: 'Lunch ideas near the office' });
    act(() => opener.focus());
    const reached = within(row).getByRole('button', { name: deleteName });
    expect(reached.tabIndex).not.toBe(-1);
    act(() => reached.focus());
    expect(document.activeElement).toBe(reached);
    act(() => reached.blur());
    expect(within(row).queryByRole('button', { name: deleteName })).toBeNull();
  });

  it('archives the idle chats with an undo', async () => {
    const { onArchived } = await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Archive idle' }));
    const undo = await screen.findByRole('button', { name: 'Undo' });
    expect(screen.getByText('2 idle chats archived')).toBeDefined();
    expect(onArchived).toHaveBeenCalledWith([
      chatIdOf({ key: 'lunch' }),
      chatIdOf({ key: 'flaky' }),
    ]);
    expect(screen.queryByRole('region', { name: 'Idle' })?.textContent).not.toContain(
      'Lunch ideas',
    );

    fireEvent.click(undo);
    await waitFor(() => expect(titlesIn('Idle')).toContain('Lunch ideas near the office'));
  });

  it('filters by title and answer text', async () => {
    await renderList();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search chats' }), {
      target: { value: 'ledger' },
    });
    expect(screen.queryByRole('region', { name: 'Today' })).toBeNull();
    expect(titlesIn('Idle')).toEqual(['Flaky test in ledger-core']);
  });

  it('opens a chat when its row is clicked', async () => {
    const { onSelect } = await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Where is the consent step?' }));
    expect(onSelect).toHaveBeenCalledWith(chatIdOf({ key: 'consent' }));
  });

  describe('row menu', () => {
    const openMenu = (title: string) =>
      fireEvent.click(screen.getByRole('button', { name: `More actions for ${title}` }));

    it('opens from the more button with the five actions', async () => {
      await renderList();

      openMenu('Where is the consent step?');

      const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
      expect(items).toEqual(['Rename', 'Mark as unread', 'Pin', 'Archive', 'Delete']);
    });

    it('renames in place: Enter saves, Escape cancels', async () => {
      await renderList();

      openMenu('Where is the consent step?');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
      const input = await screen.findByRole('textbox', { name: 'Rename chat' });
      fireEvent.change(input, { target: { value: 'Consent step' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Consent step' })).toBeDefined(),
      );

      openMenu('What changed in payments-api');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
      const second = await screen.findByRole('textbox', { name: 'Rename chat' });
      fireEvent.keyDown(second, { key: 'Escape' });
      expect(screen.queryByRole('textbox', { name: 'Rename chat' })).toBeNull();
      expect(screen.getByRole('button', { name: 'What changed in payments-api' })).toBeDefined();
    });

    it('marks a chat as unread', async () => {
      await renderList();

      openMenu('Lunch ideas near the office');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Mark as unread' }));

      expect(useAppStore.getState().unreadChatIds).toEqual([chatIdOf({ key: 'lunch' })]);
      expect(within(rowOf('lunch')).getByRole('img', { name: 'New reply' })).toBeDefined();
    });

    it('asks before deleting and leaves the sessions alone', async () => {
      const { onDeleted } = await renderList();

      openMenu('Lunch ideas near the office');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      expect(screen.getByText('Delete chat?')).toBeDefined();
      expect(rowOf('lunch')).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(onDeleted).toHaveBeenCalledWith([chatIdOf({ key: 'lunch' })]));
      expect(rowOf('lunch')).toBeNull();
    });

    it('offers Archive instead in the delete confirm', async () => {
      const { onArchived } = await renderList();

      openMenu('Lunch ideas near the office');
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      fireEvent.click(screen.getByRole('button', { name: 'Archive instead' }));

      await waitFor(() => expect(onArchived).toHaveBeenCalledWith([chatIdOf({ key: 'lunch' })]));
      expect(rowOf('lunch')).toBeNull();
      expect(screen.getByRole('button', { name: /Archived · 1/ })).toBeDefined();
    });
  });

  describe('archived view', () => {
    const ARCHIVED: ReadonlyArray<ChatSeed> = [
      ...SEEDS,
      {
        key: 'invoice',
        title: 'Northwind invoice export format',
        ageMs: 3 * CHAT_DAY,
        isArchived: true,
      },
      { key: 'sign', title: 'Acme webhook signing', ageMs: 2 * CHAT_DAY, isArchived: true },
    ];

    it('shows the Archived row only when something is archived', async () => {
      await renderList();

      expect(screen.queryByText(/Archived ·/)).toBeNull();
    });

    it('switches the rail to the archived chats and back', async () => {
      await renderList(ARCHIVED);

      fireEvent.click(await screen.findByRole('button', { name: /Archived · 2/ }));
      expect(screen.getByRole('button', { name: 'Northwind invoice export format' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'New chat' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Chats' }));
      expect(screen.getByRole('button', { name: 'New chat' })).toBeDefined();
    });

    it('restores one chat', async () => {
      await renderList(ARCHIVED);

      fireEvent.click(await screen.findByRole('button', { name: /Archived · 2/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Restore Acme webhook signing' }));

      await waitFor(() =>
        expect(
          useAppStore
            .getState()
            .chatsByWorkspace[CHAT_WORKSPACE_ID]?.some(
              (chat) => chat.id === chatIdOf({ key: 'sign' }),
            ),
        ).toBe(true),
      );
    });

    it('deletes one archived chat after a confirm without an archive option', async () => {
      const { onDeleted } = await renderList(ARCHIVED);

      fireEvent.click(await screen.findByRole('button', { name: /Archived · 2/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete Acme webhook signing' }));
      expect(screen.queryByRole('button', { name: 'Archive instead' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(onDeleted).toHaveBeenCalledWith([chatIdOf({ key: 'sign' })]));
      expect(screen.queryByRole('button', { name: 'Acme webhook signing' })).toBeNull();
    });

    it('deletes every archived chat after one inline confirm', async () => {
      const { onDeleted } = await renderList(ARCHIVED);

      fireEvent.click(await screen.findByRole('button', { name: /Archived · 2/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete all archived' }));
      expect(screen.getByText('Delete 2 chats for good?')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Delete 2' }));

      await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
      expect(onDeleted).toHaveBeenCalledWith(
        expect.arrayContaining([chatIdOf({ key: 'invoice' }), chatIdOf({ key: 'sign' })]),
      );
    });

    it('searches the archived chats', async () => {
      await renderList(ARCHIVED);

      fireEvent.click(await screen.findByRole('button', { name: /Archived · 2/ }));
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
      chatId: chatIdOf({ key: chatKey }),
      sessionId: sessionId as ChatSessionLink['sessionId'],
      messageId: null,
      kind: 'new',
      createdAt: new Date().toISOString() as IsoDateTime,
    });
    const sessionOf = (id: string, goal: string, deletedAt?: string): Session =>
      aSession({
        id: id as SessionId,
        goal,
        ...(deletedAt !== undefined && { deletedAt: deletedAt as IsoDateTime }),
      });

    it('shows a session mark on a linked chat and none on the others', async () => {
      await renderList();
      act(() =>
        useAppStore.setState({
          chatLinks: { [chatIdOf({ key: 'consent' })]: [linkOf('consent', 's1')] },
          sessions: [sessionOf('s1', 'Ask for consent again')],
        }),
      );

      expect(within(rowOf('consent')).getByText('session')).toBeDefined();
      expect(within(rowOf('lunch')).queryByText('session')).toBeNull();
    });

    it('counts several sessions', async () => {
      await renderList();
      act(() =>
        useAppStore.setState({
          chatLinks: {
            [chatIdOf({ key: 'consent' })]: [linkOf('consent', 's1'), linkOf('consent', 's2')],
          },
          sessions: [sessionOf('s1', 'One'), sessionOf('s2', 'Two')],
        }),
      );

      expect(within(rowOf('consent')).getByText('2 sessions')).toBeDefined();
    });

    it('ignores links to deleted or missing sessions', async () => {
      await renderList();
      act(() =>
        useAppStore.setState({
          chatLinks: {
            [chatIdOf({ key: 'consent' })]: [linkOf('consent', 's1'), linkOf('consent', 's2')],
          },
          sessions: [sessionOf('s1', 'Gone', '2026-09-01T00:00:00.000Z')],
        }),
      );

      expect(within(rowOf('consent')).queryByText(/session/)).toBeNull();
    });
  });

  describe('model on every row', () => {
    const CLAUDE = { provider: 'anthropic', model: 'sonnet-5' } as const;
    const CODEX = { provider: 'codex', model: 'gpt-5.6-sol' } as const;
    const MODELS: ReadonlyArray<ChatSeed> = [
      { key: 'solo', title: 'One model only', ageMs: MINUTE, ...CLAUDE, effort: 'medium' },
      {
        key: 'mixed',
        title: 'Two models over time',
        ageMs: 2 * MINUTE,
        ...CODEX,
        effort: 'high',
        used: [CLAUDE, CODEX],
      },
      { key: 'plain', title: 'No effort set', ageMs: 3 * MINUTE, ...CLAUDE, effort: null },
    ];

    const modelOf = (key: string): HTMLElement =>
      within(rowOf(key)).getByRole('img', { name: /messages?$/ });

    it('shows the model of a chat that used only one, by name with its effort', async () => {
      await renderList(MODELS);

      const solo = modelOf('solo');
      const name = chatModelLabel(CLAUDE);
      expect(solo.getAttribute('aria-label')).toBe(`${name} · Medium · 2 messages`);
      expect(within(solo).getByText(`${name} · Medium`)).toBeDefined();
      expect(solo.querySelectorAll('svg')).toHaveLength(1);
    });

    it('drops the effort from the name when the chat has none', async () => {
      await renderList(MODELS);

      expect(within(modelOf('plain')).getByText(chatModelLabel(CLAUDE))).toBeDefined();
    });

    it('names the current model first, then the others it used, with one glyph per provider', async () => {
      await renderList(MODELS);

      const mixed = modelOf('mixed');
      expect(mixed.getAttribute('aria-label')).toBe(
        `${chatModelLabel(CODEX)} · High · Also used ${chatModelLabel(CLAUDE)} · 4 messages`,
      );
      expect(mixed.querySelectorAll('svg')).toHaveLength(2);
      expect(within(mixed).getByText(`${chatModelLabel(CODEX)} · High`)).toBeDefined();
    });

    it('keeps the model on a chat that has not answered yet', async () => {
      await renderList([
        { key: 'fresh', title: 'Fresh chat', ageMs: MINUTE, ...CLAUDE, effort: 'low', used: [] },
      ]);

      const fresh = within(rowOf('fresh')).getByRole('img', {
        name: `${chatModelLabel(CLAUDE)} · Low`,
      });
      expect(fresh.querySelectorAll('svg')).toHaveLength(1);
    });
  });
});

describe('ChatList initial read states', () => {
  it('shows three loading rows before data arrives, then keeps the loaded list', async () => {
    await renderList();
    const chats = useAppStore.getState().chatsByWorkspace[CHAT_WORKSPACE_ID] ?? [];
    act(() => useAppStore.setState({ chatsByWorkspace: {} }));
    expect(screen.getAllByRole('status', { name: 'Loading chats' })).toHaveLength(3);
    expect(screen.queryByText('No chats yet')).toBeNull();
    act(() => useAppStore.setState({ chatsByWorkspace: { [CHAT_WORKSPACE_ID]: chats } }));
    screen.getByRole('button', { name: 'Where is the consent step?' });
    expect(screen.queryByRole('status', { name: 'Loading chats' })).toBeNull();
  });

  it('offers Start a chat only after the empty list has been read', async () => {
    await renderList([]);
    screen.getByRole('heading', { name: 'No chats yet' });
    screen.getByRole('button', { name: 'Start a chat' });
    expect(screen.queryByRole('status', { name: 'Loading chats' })).toBeNull();
  });

  it('clears a filter with no matches and restores the list', async () => {
    await renderList();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search chats' }), {
      target: { value: 'missing-harborline' },
    });
    screen.getByText('No chats match this filter.');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));
    screen.getByRole('button', { name: 'Where is the consent step?' });
    expect(screen.queryByText('No chats match this filter.')).toBeNull();
  });

  it('shows a failure with Retry and Details instead of the first-time state', async () => {
    await renderList([]);
    act(() =>
      useAppStore.setState({
        chatsByWorkspace: {},
        chatLoadErrors: { [CHAT_WORKSPACE_ID]: 'Could not read the chat list' },
      }),
    );
    screen.getByRole('alert');
    screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    screen.getByText('Could not read the chat list');
    expect(screen.queryByText('No chats yet')).toBeNull();
  });
});
