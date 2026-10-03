// @vitest-environment happy-dom

const { holder, renders } = vi.hoisted(() => ({
  holder: { backend: null as ChatBackend | null },
  renders: [] as string[],
}));

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

vi.mock('../../activeChatBackend', () => ({
  activeChatBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

vi.mock('../../hooks/useChatSessionMarker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useChatSessionMarker')>();
  return {
    ...actual,
    useChatSessionMarker: (params: Parameters<typeof actual.useChatSessionMarker>[0]) => {
      renders.push(params.chatId);
      return actual.useChatSessionMarker(params);
    },
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ChatId, ChatSummary } from '@goodboy/types';
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
import type { ChatBackend } from '../../chatBackend';
import { ChatList } from './index';

vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));

const COUNT = 500;

const MINUTE = 60_000;

const SEEDS: ReadonlyArray<ChatSeed> = Array.from({ length: COUNT }, (_, index) => ({
  key: `n${index}`,
  title: `Reconcile batch ${index + 1}`,
  ageMs: (index + 1) * MINUTE,
}));

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const NONE: ReadonlyArray<ChatSummary> = [];

const Harness = () => {
  const chats = useAppStore((state) => state.chatsByWorkspace[CHAT_WORKSPACE_ID] ?? NONE);
  return (
    <ToastProvider>
      <ChatList
        workspaceId={CHAT_WORKSPACE_ID}
        chats={chats}
        selectedId={null}
        onSelect={vi.fn()}
        onNew={vi.fn()}
        onArchived={vi.fn()}
        onDeleted={vi.fn()}
      />
    </ToastProvider>
  );
};

const mount = async () => {
  holder.backend = newChatBackend();
  await seedChats({ backend: holder.backend, seeds: SEEDS });
  await useAppStore.getState().loadChats({ workspaceId: CHAT_WORKSPACE_ID });
  render(<Harness />);
  await act(async () => undefined);
  renders.length = 0;
};

const boxOf = (index: number): HTMLElement =>
  screen.getByRole('checkbox', { name: `Select Reconcile batch ${index + 1}` });

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ unreadChatIds: [], chatStreams: {}, chatLinks: {} });
  renders.length = 0;
});

afterEach(cleanup);

describe('ChatList cost at 500 chats', () => {
  it('lists every chat', async () => {
    await mount();

    expect(screen.getAllByRole('checkbox')).toHaveLength(COUNT);
  });

  it('redraws one row when one chat is renamed', async () => {
    await mount();

    await act(async () => {
      await useAppStore.getState().renameChat({
        chatId: chatIdOf({ key: 'n41' }),
        title: 'Reconcile batch 42 for Northwind',
      });
    });

    expect(renders).toEqual([chatIdOf({ key: 'n41' })]);
    expect(screen.getByRole('button', { name: 'Reconcile batch 42 for Northwind' })).toBeDefined();
  });

  it('redraws one row when one chat gets a new reply flag', async () => {
    await mount();

    act(() => useAppStore.getState().markChatUnread({ chatId: chatIdOf({ key: 'n7' }) }));

    expect(renders).toEqual([chatIdOf({ key: 'n7' })]);
  });

  it('redraws one row when one chat joins the selection, and one more when another does', async () => {
    await mount();

    fireEvent.click(boxOf(7));
    expect(renders).toEqual([chatIdOf({ key: 'n7' })]);

    renders.length = 0;
    fireEvent.click(boxOf(8));
    expect(renders).toEqual([chatIdOf({ key: 'n8' })]);
  });

  it('redraws only the rows whose state changed when the selection is cleared', async () => {
    await mount();
    fireEvent.click(boxOf(7));
    fireEvent.click(boxOf(8));
    renders.length = 0;

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    const ids: ReadonlyArray<ChatId> = [chatIdOf({ key: 'n7' }), chatIdOf({ key: 'n8' })];
    expect([...renders].sort()).toEqual([...ids].sort());
  });
});
