// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

const { holder } = vi.hoisted(() => {
  const box: { backend: ChatBackend | null } = { backend: null };
  return { holder: box };
});

vi.mock('./activeChatBackend', () => ({
  activeChatBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { workspaceIdOf } from '../../__tests__/helpers/brandedIds';
import {
  CHAT_WORKSPACE_ID,
  chatIdOf,
  newChatBackend,
  seedChats,
} from '../../__tests__/helpers/chatListFixtures';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import type { ChatBackend } from './chatBackend';
import { offerArchiveUndo } from './offerArchiveUndo';

const MINUTE = 60_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const openedChat = () => {
  const studio = useAppStore.getState().appStudio;
  return studio?.kind === 'chat' ? studio.chatId : null;
};

const archiveRefund = async (): Promise<void> => {
  holder.backend = newChatBackend();
  await seedChats({
    backend: holder.backend,
    seeds: [
      { key: 'consent', title: 'Where is the consent step?', ageMs: MINUTE },
      { key: 'refund', title: 'Refund idempotency options', ageMs: 2 * MINUTE },
    ],
  });
  useAppStore.setState({ currentWorkspaceId: CHAT_WORKSPACE_ID });
  await useAppStore.getState().loadChats({ workspaceId: CHAT_WORKSPACE_ID });
  useAppStore
    .getState()
    .openStudio({ studio: { kind: 'chat', chatId: chatIdOf({ key: 'consent' }) } });
  await useAppStore
    .getState()
    .archiveChats({ workspaceId: CHAT_WORKSPACE_ID, chatIds: [chatIdOf({ key: 'refund' })] });
};

type KeyParams = {
  readonly key: string;
};

const isListed = ({ key }: KeyParams): boolean =>
  (useAppStore.getState().chatsByWorkspace[CHAT_WORKSPACE_ID] ?? []).some(
    (chat) => chat.id === chatIdOf({ key }),
  );

beforeEach(async () => {
  await resetStoryStore();
});

describe('offerArchiveUndo', () => {
  it('brings the chat back on undo and selects it again when it was the open one', async () => {
    await archiveRefund();
    offerArchiveUndo({
      workspaceId: CHAT_WORKSPACE_ID,
      chatIds: [chatIdOf({ key: 'refund' })],
      message: 'Refund idempotency options',
      selectedId: chatIdOf({ key: 'refund' }),
      showToast: vi.fn(),
    });

    expect(await useAppStore.getState().undoLastOperation()).toBe(true);

    expect(isListed({ key: 'refund' })).toBe(true);
    expect(openedChat()).toBe(chatIdOf({ key: 'refund' }));
  });

  it('leaves the selection alone when the archived chat was not the open one', async () => {
    await archiveRefund();
    offerArchiveUndo({
      workspaceId: CHAT_WORKSPACE_ID,
      chatIds: [chatIdOf({ key: 'refund' })],
      message: 'Refund idempotency options',
      selectedId: chatIdOf({ key: 'consent' }),
      showToast: vi.fn(),
    });

    await useAppStore.getState().undoLastOperation();

    expect(isListed({ key: 'refund' })).toBe(true);
    expect(openedChat()).toBe(chatIdOf({ key: 'consent' }));
  });

  it('restores the chat but selects nothing after a switch to another workspace', async () => {
    await archiveRefund();
    offerArchiveUndo({
      workspaceId: CHAT_WORKSPACE_ID,
      chatIds: [chatIdOf({ key: 'refund' })],
      message: 'Refund idempotency options',
      selectedId: chatIdOf({ key: 'refund' }),
      showToast: vi.fn(),
    });
    useAppStore.setState({ currentWorkspaceId: workspaceIdOf({ value: 'ws-northwind' }) });

    await useAppStore.getState().undoLastOperation();

    expect(isListed({ key: 'refund' })).toBe(true);
    expect(openedChat()).toBe(chatIdOf({ key: 'consent' }));
  });

  it('announces the archive with Undo through the toast it is given', async () => {
    await archiveRefund();
    const showToast = vi.fn();

    offerArchiveUndo({
      workspaceId: CHAT_WORKSPACE_ID,
      chatIds: [chatIdOf({ key: 'refund' })],
      title: 'Chat archived',
      message: 'Refund idempotency options',
      selectedId: null,
      showToast,
    });

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Chat archived',
        message: 'Refund idempotency options',
        action: expect.objectContaining({ label: 'Undo' }),
      }),
    );
  });
});
