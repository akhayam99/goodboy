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
import type { ChatId, ChatSummary } from '@goodboy/types';
import {
  CHAT_DAY,
  CHAT_WORKSPACE_ID,
  chatIdOf,
  newChatBackend,
  seedChats,
  type ChatSeed,
} from '../../../../__tests__/helpers/chatListFixtures';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { bindTarget } from '../../../actions/registry';
import type { ChatBackend } from '../../chatBackend';
import { ChatList } from './index';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));

const MINUTE = 60_000;

const SEEDS: ReadonlyArray<ChatSeed> = [
  { key: 'release', title: 'Release checklist', ageMs: 5 * CHAT_DAY, isPinned: true },
  { key: 'consent', title: 'Where is the consent step?', ageMs: MINUTE },
  { key: 'refund', title: 'Refund idempotency options', ageMs: 2 * MINUTE },
  { key: 'changes', title: 'What changed in payments-api', ageMs: 3 * CHAT_DAY },
  { key: 'lunch', title: 'Lunch ideas near the office', ageMs: 9 * CHAT_DAY },
];

const TITLES: Readonly<Record<string, string>> = Object.fromEntries(
  SEEDS.map((seed) => [seed.key, seed.title]),
);

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

const renderList = async () => {
  holder.backend = newChatBackend();
  await seedChats({ backend: holder.backend, seeds: SEEDS });
  await useAppStore.getState().loadChats({ workspaceId: CHAT_WORKSPACE_ID });
  const onSelect = vi.fn();
  const onArchived = vi.fn();
  const onDeleted = vi.fn();
  render(<Harness onSelect={onSelect} onArchived={onArchived} onDeleted={onDeleted} />);
  await act(async () => undefined);
  return { onSelect, onArchived, onDeleted };
};

const rowOf = (key: string): HTMLElement =>
  document.querySelector(`[data-chat-row="${chatIdOf({ key })}"]`) as HTMLElement;

const boxOf = (key: string): HTMLElement =>
  screen.getByRole('checkbox', { name: `Select ${TITLES[key] ?? ''}` });

const toolbar = (): HTMLElement => screen.getByRole('toolbar');

const openerOf = (key: string): HTMLElement =>
  screen.getByRole('button', { name: TITLES[key] ?? '' });

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ unreadChatIds: [], chatStreams: {}, chatLinks: {} });
});

afterEach(cleanup);

describe('ChatList selection', () => {
  it('starts a selection from a row checkbox and raises one bar for the whole list', async () => {
    await renderList();
    expect(screen.queryByRole('toolbar')).toBeNull();

    fireEvent.click(boxOf('consent'));

    expect(within(toolbar()).getByText('1 selected')).toBeDefined();
    expect(screen.getAllByRole('toolbar')).toHaveLength(1);
    expect(boxOf('consent').getAttribute('aria-checked')).toBe('true');
    expect(boxOf('refund').getAttribute('aria-checked')).toBe('false');
  });

  it('reserves the bar its own space under the scroll area while a selection is open, and gives it back on clear', async () => {
    await renderList();
    const list = screen.getByRole('navigation', { name: 'Chats' });
    expect(list.getAttribute('data-selecting')).toBe('false');
    expect(document.querySelector('[data-selection-dock]')).toBeNull();

    fireEvent.click(boxOf('consent'));

    const dock = document.querySelector('[data-selection-dock]') as HTMLElement;
    expect(list.getAttribute('data-selecting')).toBe('true');
    expect(dock.getAttribute('data-placement')).toBe('flow');
    expect(list.contains(dock)).toBe(false);
    let scrollArea: HTMLElement = list;
    while (scrollArea.parentElement !== dock.parentElement) {
      scrollArea = scrollArea.parentElement as HTMLElement;
    }
    expect(scrollArea.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    expect(document.querySelector('[data-selection-dock]')).toBeNull();
    expect(list.getAttribute('data-selecting')).toBe('false');
  });

  it('does not open the chat when a checkbox is clicked', async () => {
    const { onSelect } = await renderList();

    fireEvent.click(boxOf('consent'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects across groups with a shift-click range, in the order the list shows', async () => {
    await renderList();
    fireEvent.click(boxOf('release'));

    fireEvent.click(boxOf('changes'), { shiftKey: true });

    expect(within(toolbar()).getByText('4 selected')).toBeDefined();
    expect(boxOf('lunch').getAttribute('aria-checked')).toBe('false');
  });

  it('toggles a row with a command-click on the row instead of opening it', async () => {
    const { onSelect } = await renderList();

    fireEvent.click(openerOf('refund'), { metaKey: true });

    expect(onSelect).not.toHaveBeenCalled();
    expect(boxOf('refund').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(openerOf('refund'), { metaKey: true });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('still opens the chat on a plain click while a selection is on', async () => {
    const { onSelect } = await renderList();
    fireEvent.click(boxOf('refund'));

    fireEvent.click(openerOf('consent'));

    expect(onSelect).toHaveBeenCalledWith(chatIdOf({ key: 'consent' }));
  });

  it('offers every row, and selects them all from the bar', async () => {
    await renderList();
    fireEvent.click(boxOf('consent'));

    fireEvent.click(screen.getByRole('button', { name: 'Select all 5' }));

    expect(within(toolbar()).getByText('5 selected')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Select all/ })).toBeNull();
  });

  it('selects the row under the pointer with X, all with the select all key, clears with Escape', async () => {
    await renderList();

    fireEvent.mouseOver(openerOf('refund'));
    fireEvent.keyDown(window, { key: 'x', code: 'KeyX' });
    expect(boxOf('refund').getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(window, { key: 'a', code: 'KeyA', ctrlKey: true });
    expect(within(toolbar()).getByText('5 selected')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('drops a selected chat from the selection when the search hides it', async () => {
    await renderList();
    fireEvent.click(boxOf('consent'));
    fireEvent.click(boxOf('lunch'));

    fireEvent.change(screen.getByRole('textbox', { name: 'Search chats' }), {
      target: { value: 'lunch' },
    });

    await waitFor(() => expect(within(toolbar()).getByText('1 selected')).toBeDefined());
  });

  it('names the verbs with the same words as the context menu of the selection', async () => {
    await renderList();
    fireEvent.click(boxOf('consent'));
    fireEvent.click(boxOf('refund'));

    const menu =
      bindTarget({
        state: useAppStore.getState(),
        target: {
          kind: 'chats',
          facts: {
            chatIds: [chatIdOf({ key: 'consent' }), chatIdOf({ key: 'refund' })],
            titles: [TITLES.consent ?? '', TITLES.refund ?? ''],
            onArchive: vi.fn(),
            onDelete: vi.fn(async () => undefined),
          },
        },
      })
        ?.resolve()
        .map((action) => action.label) ?? [];
    const bar = within(toolbar())
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .filter((label) => /^(Archive|Delete) /.test(label));

    expect(menu).toEqual(['Archive 2 chats', 'Delete 2 chats']);
    expect(bar).toEqual(menu);
  });

  it('archives at once, with no confirmation, clears the selection and offers Undo', async () => {
    const { onArchived } = await renderList();
    fireEvent.click(boxOf('consent'));
    fireEvent.click(boxOf('refund'));

    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Archive 2 chats' }));

    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
    expect(onArchived).toHaveBeenCalledWith([
      chatIdOf({ key: 'consent' }),
      chatIdOf({ key: 'refund' }),
    ]);
    expect(rowOf('consent')).toBeNull();
    expect(rowOf('refund')).toBeNull();
    expect(screen.getByText('2 chats archived')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rowOf('consent')).not.toBeNull());
    expect(rowOf('refund')).not.toBeNull();
  });

  it('asks once for the whole selection, naming what goes and what stays', async () => {
    await renderList();
    fireEvent.click(boxOf('consent'));
    fireEvent.click(boxOf('refund'));
    fireEvent.click(boxOf('lunch'));

    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Delete 3 chats' }));

    const confirm = screen.getByRole('group', { name: 'Delete 3 chats?' });
    expect(screen.getAllByRole('group', { name: /^Delete \d+ chats?\?$/ })).toHaveLength(1);
    expect(confirm.textContent).toContain('Goes');
    expect(confirm.textContent).toContain('Stays');
    expect(within(confirm).getByText(TITLES.consent ?? '')).toBeDefined();
    expect(within(confirm).getByRole('button', { name: 'Archive instead' })).toBeDefined();
    expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(rowOf('consent')).not.toBeNull();
  });

  it('deletes the whole selection in one go once confirmed', async () => {
    const { onDeleted } = await renderList();
    fireEvent.click(boxOf('consent'));
    fireEvent.click(boxOf('refund'));
    fireEvent.click(boxOf('lunch'));
    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Delete 3 chats' }));

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Delete 3 chats?' })).getByRole('button', {
        name: 'Delete 3 chats',
      }),
    );

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onDeleted).toHaveBeenCalledWith([
      chatIdOf({ key: 'consent' }),
      chatIdOf({ key: 'refund' }),
      chatIdOf({ key: 'lunch' }),
    ]);
    expect(rowOf('consent')).toBeNull();
    expect(rowOf('lunch')).toBeNull();
    expect(rowOf('changes')).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
    expect(await holder.backend?.listChats({ workspaceId: CHAT_WORKSPACE_ID })).toHaveLength(2);
  });

  it('archives instead from the confirmation', async () => {
    await renderList();
    fireEvent.click(boxOf('consent'));
    fireEvent.click(boxOf('refund'));
    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Delete 2 chats' }));

    fireEvent.click(screen.getByRole('button', { name: 'Archive instead' }));

    await waitFor(() => expect(rowOf('consent')).toBeNull());
    expect(await holder.backend?.listChats({ workspaceId: CHAT_WORKSPACE_ID })).toHaveLength(3);
    expect(
      await holder.backend?.listChats({ workspaceId: CHAT_WORKSPACE_ID, includeArchived: true }),
    ).toHaveLength(5);
  });

  it('opens the confirmation from the Delete key', async () => {
    await renderList();
    fireEvent.click(boxOf('consent'));

    fireEvent.mouseOver(openerOf('consent'));
    fireEvent.keyDown(window, { key: 'Delete', code: 'Delete' });

    expect(await screen.findByRole('group', { name: 'Delete 1 chat?' })).toBeDefined();
  });
});

describe('ChatList delete on the row', () => {
  it('keeps a Delete button on every row without any hover', async () => {
    await renderList();

    for (const seed of SEEDS) {
      expect(
        within(rowOf(seed.key)).getByRole('button', { name: `Delete ${seed.title}` }),
      ).toBeDefined();
    }
  });

  it('asks in the row after one click, then deletes with the second', async () => {
    const { onDeleted } = await renderList();

    fireEvent.click(screen.getByRole('button', { name: `Delete ${TITLES.lunch}` }));

    const confirm = within(rowOf('lunch'));
    expect(confirm.getByText('Delete chat?')).toBeDefined();
    expect(rowOf('lunch').textContent).toContain(TITLES.lunch);
    expect(rowOf('changes').textContent).not.toContain('Delete chat?');

    fireEvent.click(confirm.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith([chatIdOf({ key: 'lunch' })]));
    expect(rowOf('lunch')).toBeNull();
  });

  it('gives the row back on Cancel without deleting anything', async () => {
    const { onDeleted } = await renderList();
    fireEvent.click(screen.getByRole('button', { name: `Delete ${TITLES.lunch}` }));

    fireEvent.click(within(rowOf('lunch')).getByRole('button', { name: 'Cancel' }));

    expect(within(rowOf('lunch')).getByRole('button', { name: TITLES.lunch ?? '' })).toBeDefined();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('archives from the row confirmation and keeps the chat', async () => {
    const { onArchived } = await renderList();
    fireEvent.click(screen.getByRole('button', { name: `Delete ${TITLES.lunch}` }));

    fireEvent.click(within(rowOf('lunch')).getByRole('button', { name: 'Archive instead' }));

    await waitFor(() => expect(onArchived).toHaveBeenCalledWith([chatIdOf({ key: 'lunch' })]));
    expect(
      await holder.backend?.listChats({ workspaceId: CHAT_WORKSPACE_ID, includeArchived: true }),
    ).toHaveLength(5);
  });
});
