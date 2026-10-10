// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

const { holder } = vi.hoisted(() => ({ holder: { backend: null as ChatBackend | null } }));

vi.mock('../activeChatBackend', () => ({
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
import type { ChatId } from '@goodboy/types';
import {
  CHAT_WORKSPACE_ID,
  chatIdOf,
  newChatBackend,
  seedChats,
  type ChatSeed,
} from '../../../__tests__/helpers/chatListFixtures';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { selectChatDoor } from '../../../store/slices/chat-last-open/selectChatDoor';
import type { ChatBackend } from '../chatBackend';
import { ChatStudio } from './ChatStudio';

const MINUTE = 60_000;

const SEEDS: ReadonlyArray<ChatSeed> = [
  { key: 'consent', title: 'Where is the consent step?', ageMs: MINUTE },
  { key: 'refund', title: 'Refund idempotency options', ageMs: 2 * MINUTE },
  { key: 'changes', title: 'What changed in payments-api', ageMs: 3 * MINUTE },
];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const Host = () => {
  const studio = useAppStore((state) => state.appStudio);
  if (studio?.kind !== 'chat') {
    return <p>Board</p>;
  }
  return (
    <ToastProvider>
      <ChatStudio
        workspaceId={CHAT_WORKSPACE_ID}
        chatId={studio.chatId}
        onClose={() => useAppStore.getState().closeStudio()}
      />
    </ToastProvider>
  );
};

const openedChat = (): ChatId | null => {
  const studio = useAppStore.getState().appStudio;
  return studio?.kind === 'chat' ? studio.chatId : null;
};

const pressChatDoor = async (): Promise<void> => {
  await act(async () => {
    useAppStore.getState().openStudio({
      studio: { kind: 'chat', chatId: selectChatDoor({ state: useAppStore.getState() }) },
    });
  });
};

const leaveForBoard = async (): Promise<void> => {
  await act(async () => {
    useAppStore.getState().closeStudio();
  });
  expect(screen.getByText('Board')).toBeDefined();
};

const renderStudio = async () => {
  holder.backend = newChatBackend();
  await seedChats({ backend: holder.backend, seeds: SEEDS });
  useAppStore.setState({ currentWorkspaceId: CHAT_WORKSPACE_ID });
  await useAppStore.getState().loadChats({ workspaceId: CHAT_WORKSPACE_ID });
  render(<Host />);
  await pressChatDoor();
};

const rowButton = (title: string): HTMLElement => screen.getByRole('button', { name: title });

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ unreadChatIds: [], chatStreams: {}, chatLinks: {} });
});

afterEach(cleanup);

describe('the Chat door', () => {
  it('opens the most recent chat when none was open before', async () => {
    await renderStudio();

    expect(openedChat()).toBe(chatIdOf({ key: 'consent' }));
  });

  it('comes back to the chat that was open after a visit to the Board', async () => {
    await renderStudio();
    fireEvent.click(rowButton('Refund idempotency options'));
    expect(openedChat()).toBe(chatIdOf({ key: 'refund' }));

    await leaveForBoard();
    await pressChatDoor();

    expect(openedChat()).toBe(chatIdOf({ key: 'refund' }));
  });

  it('lands on the next most recent chat after the open one is archived', async () => {
    await renderStudio();
    fireEvent.click(rowButton('Refund idempotency options'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Refund idempotency options' }));

    fireEvent.click(
      within(screen.getByRole('toolbar')).getByRole('button', { name: 'Archive 1 chat' }),
    );

    await waitFor(() => expect(openedChat()).toBe(chatIdOf({ key: 'consent' })));
  });

  it('opens a new chat after New chat, then leaving and coming back', async () => {
    await renderStudio();
    expect(openedChat()).toBe(chatIdOf({ key: 'consent' }));

    fireEvent.click(screen.getByRole('button', { name: /^New chat/ }));
    expect(openedChat()).toBeNull();

    await leaveForBoard();
    await pressChatDoor();

    expect(openedChat()).toBeNull();
  });

  it('falls back to the most recent chat when the remembered one is gone', async () => {
    await renderStudio();
    fireEvent.click(rowButton('What changed in payments-api'));
    await leaveForBoard();

    await act(async () => {
      await useAppStore.getState().loadChats({ workspaceId: CHAT_WORKSPACE_ID });
      useAppStore.setState({
        chatsByWorkspace: {
          [CHAT_WORKSPACE_ID]: (
            useAppStore.getState().chatsByWorkspace[CHAT_WORKSPACE_ID] ?? []
          ).filter((chat) => chat.id !== chatIdOf({ key: 'changes' })),
        },
      });
    });
    await pressChatDoor();

    expect(openedChat()).toBe(chatIdOf({ key: 'consent' }));
  });
});
