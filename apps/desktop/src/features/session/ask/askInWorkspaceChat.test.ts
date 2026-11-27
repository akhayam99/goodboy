// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

vi.mock('../../workspace-chat/defaultRoutingOfWorkspace', () => ({
  defaultRoutingOfWorkspace: async () => ({
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: null,
  }),
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type ChatId, type WorkspaceId } from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import type { StoryStore } from '../../../store/storyHarness';
import { askInWorkspaceChat } from './askInWorkspaceChat';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const CHAT = brandId<ChatId>({ value: 'chat-harborline' });

let store: StoryStore;
const createChat = vi.fn(async () => CHAT);
const sendChatMessage = vi.fn(async () => true);

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  createChat.mockClear();
  sendChatMessage.mockClear();
  store.setState({ createChat, sendChatMessage });
});

describe('asking about the workspace with no session', () => {
  it('starts a workspace chat named by the call and sends the question', async () => {
    const chatId = await askInWorkspaceChat({ workspaceId: WS, question: ' What is blocked? ' });

    expect(chatId).toBe(CHAT);
    expect(createChat).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WS }));
    expect(sendChatMessage).toHaveBeenCalledWith({ chatId: CHAT, content: 'What is blocked?' });
  });

  it('starts nothing for an empty question', async () => {
    expect(await askInWorkspaceChat({ workspaceId: WS, question: '  ' })).toBeNull();
    expect(createChat).not.toHaveBeenCalled();
  });

  it('shows the error and starts no thread when the chat cannot be created', async () => {
    createChat.mockRejectedValueOnce(new Error('disk full'));
    const reportError = vi.fn(async () => undefined);
    store.setState({ reportError });

    expect(await askInWorkspaceChat({ workspaceId: WS, question: 'Why?' })).toBeNull();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't start the chat", workspaceId: WS }),
    );
    expect(sendChatMessage).not.toHaveBeenCalled();
  });
});
