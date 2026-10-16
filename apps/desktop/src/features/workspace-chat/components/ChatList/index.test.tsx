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

import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
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
  render(
    <ObjectMenuProvider>
      <Harness onSelect={onSelect} onArchived={onArchived} onDeleted={onDeleted} />
    </ObjectMenuProvider>,
  );
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

  it('dims idle chats and leaves their age to the Idle group', async () => {
    await renderList();

    expect(rowOf('lunch').getAttribute('data-idle')).toBe('true');
    expect(rowOf('lunch').textContent).not.toMatch(/idle \d+d|ago/);
  });

  it('keeps the age in one non-wrapping token', async () => {
    await renderList();

    expect(ageTokenOf({ time: '14d ago' })).toBe('14d\u00a0ago');
    expect(ageTokenOf({ time: 'just now' })).toBe('just\u00a0now');
  });

  it('draws no actions on a row; right click opens its menu, with Delete inside it', async () => {
    await renderList();
    const row = rowOf('lunch');

    expect(
      within(row).queryByRole('button', { name: 'Delete Lunch ideas near the office' }),
    ).toBeNull();
    expect(
      within(row).queryByRole('button', { name: 'More actions for Lunch ideas near the office' }),
    ).toBeNull();

    fireEvent.contextMenu(within(row).getByRole('button', { name: 'Lunch ideas near the office' }));

    expect(await screen.findByRole('menuitem', { name: /Delete/ })).toBeDefined();
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
      fireEvent.contextMenu(screen.getByRole('button', { name: title }));

    it('opens on right click with the five actions', async () => {
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
      fireEvent.click(screen.getByRole('button', { name: 'Chats' }));
      expect(screen.getByRole('textbox', { name: 'Search chats' })).toBeDefined();
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
      const dialog = screen.getByRole('dialog', { name: 'Delete "Acme webhook signing"?' });
      expect(within(dialog).queryByRole('button', { name: 'Archive instead' })).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete chat' }));

      await waitFor(() => expect(onDeleted).toHaveBeenCalledWith([chatIdOf({ key: 'sign' })]));
      expect(screen.queryByRole('button', { name: 'Acme webhook signing' })).toBeNull();
    });

    it('deletes every archived chat after one popover confirm', async () => {
      const { onDeleted } = await renderList(ARCHIVED);

      fireEvent.click(await screen.findByRole('button', { name: /Archived · 2/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete all archived' }));
      const dialog = screen.getByRole('dialog', { name: 'Delete 2 archived chats?' });
      expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete 2 chats' }));

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

      expect(
        within(rowOf('consent')).getByRole('button', {
          name: 'Open the session Ask for consent again',
        }),
      ).toBeDefined();
      expect(within(rowOf('consent')).queryByText('session')).toBeNull();
      expect(
        within(rowOf('lunch')).queryByRole('button', { name: /^Open the session/ }),
      ).toBeNull();
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

      expect(within(rowOf('consent')).getByText('2')).toBeDefined();
      expect(within(rowOf('consent')).queryByText('2 sessions')).toBeNull();
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

      expect(
        within(rowOf('consent')).queryByRole('button', { name: /^Open the session/ }),
      ).toBeNull();
    });
  });

  it('draws no model and no provider mark on a row, the room carries them', async () => {
    await renderList();

    expect(within(rowOf('consent')).queryByRole('img', { name: /messages?$/ })).toBeNull();
    expect(rowOf('consent').querySelectorAll('svg')).toHaveLength(0);
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

  it('leaves the empty first-run state and the New chat verb to the page and the sidebar', async () => {
    await renderList([]);
    expect(screen.queryByRole('button', { name: 'New chat' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'No chats yet' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start a chat' })).toBeNull();
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
