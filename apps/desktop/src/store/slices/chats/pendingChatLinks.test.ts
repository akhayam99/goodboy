// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());

const { link } = vi.hoisted(() => ({
  link: { fails: false },
}));

vi.mock('../../../features/workspace-chat/activeChatBackend', async () => {
  const { createMemoryChatBackend } =
    await import('../../../features/workspace-chat/createMemoryChatBackend');
  const backend = createMemoryChatBackend({ respond: async () => ({ status: 'done' }) });
  return {
    activeChatBackend: {
      ...backend,
      insertLink: async (params: Parameters<typeof backend.insertLink>[0]) => {
        if (link.fails) {
          throw new Error('disk full');
        }
        await backend.insertLink(params);
      },
    },
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatId, ChatMessageId, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const CHAT_ID = 'chat-payments-retry' as ChatId;
const SESSION_ID = 'session-duplicate-credit' as SessionId;
const MESSAGE_ID = 'message-plan' as ChatMessageId;

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ chatLinks: {}, pendingChatLinks: {} });
});

afterEach(() => {
  link.fails = false;
});

describe('a chat added to a session as a draft', () => {
  it('links nothing until a turn is sent in that session', () => {
    useAppStore
      .getState()
      .queueChatLink({ chatId: CHAT_ID, sessionId: SESSION_ID, messageId: MESSAGE_ID });

    expect(useAppStore.getState().chatLinks[CHAT_ID]).toBeUndefined();
    expect(useAppStore.getState().pendingChatLinks[SESSION_ID]).toEqual([
      { chatId: CHAT_ID, messageId: MESSAGE_ID },
    ]);
  });

  it('records the add link once the session sends, and clears the draft', async () => {
    useAppStore
      .getState()
      .queueChatLink({ chatId: CHAT_ID, sessionId: SESSION_ID, messageId: MESSAGE_ID });

    await useAppStore.getState().flushChatLinks({ sessionId: SESSION_ID });

    const [recorded] = useAppStore.getState().chatLinks[CHAT_ID] ?? [];
    expect(recorded?.kind).toBe('add');
    expect(recorded?.sessionId).toBe(SESSION_ID);
    expect(useAppStore.getState().pendingChatLinks[SESSION_ID]).toBeUndefined();
  });

  it('keeps the draft pending when the link cannot be saved', async () => {
    link.fails = true;
    useAppStore
      .getState()
      .queueChatLink({ chatId: CHAT_ID, sessionId: SESSION_ID, messageId: null });

    await useAppStore.getState().flushChatLinks({ sessionId: SESSION_ID });

    expect(useAppStore.getState().chatLinks[CHAT_ID]).toBeUndefined();
    expect(useAppStore.getState().pendingChatLinks[SESSION_ID]).toEqual([
      { chatId: CHAT_ID, messageId: null },
    ]);
  });
});
