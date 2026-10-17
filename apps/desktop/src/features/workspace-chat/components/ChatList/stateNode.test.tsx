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

const { holder } = vi.hoisted(() => {
  const holder: { backend: ChatBackend | null } = { backend: null };
  return { holder };
});

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
import type { ChatId, ChatMessageId, ChatSummary } from '@goodboy/types';
import { nextProviderRunId } from '@goodboy/types/testing';
import {
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
import { carriesSpec } from '../../../../test/classTokens';
import { spacingOf } from '../../../../test/boxGeometry';
import { inFlowBefore } from '../../../../test/flowLayout';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import type { ChatBackend } from '../../chatBackend';
import { ChatList } from './index';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));

const MINUTE = 60_000;

const SEEDS: ReadonlyArray<ChatSeed> = [
  { key: 'consent', title: 'Where is the consent step?', ageMs: MINUTE },
  { key: 'refund', title: 'Refund idempotency options', ageMs: 2 * MINUTE },
  { key: 'retry', title: 'Why does notify-relay retry twice?', ageMs: 3 * MINUTE },
  { key: 'rounding', title: 'Ledger rounding on refunds', ageMs: 4 * MINUTE },
];

const TITLES: Readonly<Record<string, string>> = Object.fromEntries(
  SEEDS.map((seed) => [seed.key, seed.title]),
);

const SWAP_STATES = [
  'group-hover/select-row',
  'group-focus-within/select-row',
  'group-data-[selecting=true]/select-list',
] as const;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const NONE: ReadonlyArray<ChatSummary> = [];

type HarnessProps = {
  readonly onSelect: (chatId: ChatId) => void;
  readonly onArchived: (chatIds: ReadonlyArray<ChatId>) => void;
};

const Harness = ({ onSelect, onArchived }: HarnessProps) => {
  const chats = useAppStore((state) => state.chatsByWorkspace[CHAT_WORKSPACE_ID] ?? NONE);
  return (
    <ToastProvider>
      <ChatList
        workspaceId={CHAT_WORKSPACE_ID}
        chats={chats}
        selectedId={null}
        onSelect={onSelect}
        onArchived={onArchived}
        onDeleted={vi.fn()}
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
  render(
    <ObjectMenuProvider>
      <Harness onSelect={onSelect} onArchived={onArchived} />
    </ObjectMenuProvider>,
  );
  await act(async () => undefined);
  return { onSelect, onArchived };
};

const rowOf = (key: string): HTMLElement => {
  const row = document.querySelector(`[data-chat-row="${chatIdOf({ key })}"]`);
  if (!(row instanceof HTMLElement)) {
    throw new Error(`no row for ${key}`);
  }
  return row;
};

const nodeOf = (key: string): HTMLElement => {
  const node = rowOf(key).querySelector('[data-node-kind]');
  if (!(node instanceof HTMLElement)) {
    throw new Error(`no state node on ${key}`);
  }
  return node;
};

const boxOf = (key: string): HTMLElement =>
  screen.getByRole('checkbox', { name: `Select ${TITLES[key] ?? ''}` });

const openerOf = (key: string): HTMLElement =>
  screen.getByRole('button', { name: TITLES[key] ?? '' });

const toolbar = (): HTMLElement => screen.getByRole('toolbar');

const isChatMessageId = (value: string): value is ChatMessageId => value !== '';

const messageIdOf = (value: string): ChatMessageId => {
  if (!isChatMessageId(value)) {
    throw new Error('empty message id');
  }
  return value;
};

const streamOn = (key: string) => ({
  [chatIdOf({ key })]: {
    runId: nextProviderRunId(),
    messageId: messageIdOf(`message-${key}`),
    isStopping: false,
  },
});

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ unreadChatIds: [], chatStreams: {}, chatLinks: {} });
});

afterEach(cleanup);

describe('the chat row state node', () => {
  it('draws one node per state: answering, a new reply, and a ring at rest', async () => {
    await renderList();
    act(() =>
      useAppStore.setState({
        chatStreams: streamOn('consent'),
        unreadChatIds: [chatIdOf({ key: 'refund' }), chatIdOf({ key: 'consent' })],
      }),
    );

    expect(nodeOf('consent').getAttribute('data-node-kind')).toBe('answering');
    expect(within(rowOf('consent')).getByRole('img', { name: 'Answering' })).toBeDefined();
    expect(nodeOf('refund').getAttribute('data-node-kind')).toBe('unread');
    expect(within(rowOf('refund')).getByRole('img', { name: 'New reply, unseen' })).toBeDefined();
    expect(nodeOf('retry').getAttribute('data-node-kind')).toBe('idle');
    expect(within(rowOf('retry')).getByRole('img', { name: 'No new reply' })).toBeDefined();
  });

  it('follows the store when the answer ends and when the chat is read', async () => {
    await renderList();
    act(() => useAppStore.setState({ chatStreams: streamOn('retry') }));
    expect(nodeOf('retry').getAttribute('data-node-kind')).toBe('answering');

    act(() =>
      useAppStore.setState({ chatStreams: {}, unreadChatIds: [chatIdOf({ key: 'retry' })] }),
    );
    expect(nodeOf('retry').getAttribute('data-node-kind')).toBe('unread');

    act(() => useAppStore.getState().markChatRead({ chatId: chatIdOf({ key: 'retry' }) }));
    expect(nodeOf('retry').getAttribute('data-node-kind')).toBe('idle');
  });

  it('puts the node in the leading slot, so the row keeps no empty indent', async () => {
    await renderList();

    for (const seed of SEEDS) {
      const node = nodeOf(seed.key);
      const box = boxOf(seed.key);
      const slot = node.parentElement;
      const frame = rowOf(seed.key).querySelector('[data-select-id]')?.nextElementSibling;
      if (slot === null || !(frame instanceof HTMLElement)) {
        throw new Error(`row parts missing for ${seed.key}`);
      }
      expect(slot.contains(box)).toBe(true);
      expect(inFlowBefore(node)).toEqual([]);
      expect(frame.firstElementChild?.contains(node)).toBe(true);
      expect(spacingOf({ element: frame, property: 'pl' })).toBe(8);
    }
  });

  it('turns into the checkbox on hover, on focus and while any row is selected', async () => {
    await renderList();

    for (const seed of SEEDS) {
      const anchor = boxOf(seed.key).parentElement;
      for (const state of SWAP_STATES) {
        expect(carriesSpec({ element: nodeOf(seed.key), spec: `${state}:invisible` })).toBe(true);
        expect(carriesSpec({ element: anchor, spec: `${state}:opacity-100` })).toBe(true);
      }
      expect(carriesSpec({ element: anchor, spec: 'opacity-0' })).toBe(true);
    }
  });

  it('marks the whole list as selecting once one row is picked, and keeps the picked box shown', async () => {
    await renderList();
    const list = screen.getByRole('navigation', { name: 'Chats' });

    fireEvent.click(boxOf('refund'));

    expect(list.getAttribute('data-selecting')).toBe('true');
    expect(carriesSpec({ element: boxOf('refund').parentElement, spec: 'opacity-100' })).toBe(true);
    expect(carriesSpec({ element: boxOf('consent').parentElement, spec: 'opacity-0' })).toBe(true);
  });
});

describe('the chat row from the keyboard', () => {
  it('toggles the focused row with Space and never opens it', async () => {
    const { onSelect } = await renderList();
    const opener = openerOf('refund');
    opener.focus();

    fireEvent.keyDown(opener, { key: ' ', code: 'Space' });
    fireEvent.keyUp(opener, { key: ' ', code: 'Space' });

    expect(boxOf('refund').getAttribute('aria-checked')).toBe('true');
    expect(within(toolbar()).getByText('1 selected')).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);

    fireEvent.keyDown(opener, { key: ' ', code: 'Space' });
    expect(boxOf('refund').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('extends the selection with Shift and Space, in list order', async () => {
    await renderList();
    fireEvent.keyDown(openerOf('consent'), { key: ' ', code: 'Space' });

    fireEvent.keyDown(openerOf('retry'), { key: ' ', code: 'Space', shiftKey: true });

    expect(within(toolbar()).getByText('3 selected')).toBeDefined();
    expect(boxOf('rounding').getAttribute('aria-checked')).toBe('false');
  });

  it('leaves Space alone outside a row opener', async () => {
    await renderList();
    const search = screen.getByRole('textbox', { name: 'Search chats' });

    fireEvent.keyDown(search, { key: ' ', code: 'Space' });

    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('runs the bulk verbs on rows picked with Space, unchanged', async () => {
    const { onArchived } = await renderList();
    fireEvent.keyDown(openerOf('consent'), { key: ' ', code: 'Space' });
    fireEvent.keyDown(openerOf('rounding'), { key: ' ', code: 'Space' });

    fireEvent.click(within(toolbar()).getByRole('button', { name: 'Archive 2 chats' }));

    await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
    expect(onArchived).toHaveBeenCalledWith([
      chatIdOf({ key: 'consent' }),
      chatIdOf({ key: 'rounding' }),
    ]);
  });
});
