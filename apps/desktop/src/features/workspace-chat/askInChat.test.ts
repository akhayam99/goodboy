// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatId, WorkspaceId } from '@goodboy/types';

const WORKSPACE = 'ws-1' as WorkspaceId;
const KEY = 'chat.default_model.ws-1';

const { store } = vi.hoisted(() => ({
  store: {
    currentWorkspaceId: 'ws-1' as string | null,
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
    settings: {} as Record<string, string>,
    loadSetting: vi.fn(async (_key: string) => null as string | null),
    createChat: vi.fn(async (_params: Record<string, unknown>) => 'chat-1' as ChatId),
    setChatModel: vi.fn(async (_params: Record<string, unknown>) => undefined),
    sendChatMessage: vi.fn(async (_params: Record<string, unknown>) => undefined),
    openStudio: vi.fn(),
    reportError: vi.fn(),
  },
}));

vi.mock('../../store', () => ({ useAppStore: { getState: () => store } }));

import { askInChat } from './askInChat';

beforeEach(() => {
  store.settings = {};
  store.loadSetting.mockReset();
  store.loadSetting.mockResolvedValue(null);
  store.createChat.mockClear();
  store.setChatModel.mockClear();
  store.sendChatMessage.mockClear();
  store.reportError.mockClear();
});

describe('askInChat', () => {
  it('starts on the automatic model when no default is saved', async () => {
    await askInChat({ question: 'where is auth?' });

    expect(store.createChat).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      provider: 'anthropic',
      model: 'sonnet-5',
    });
    expect(store.setChatModel).not.toHaveBeenCalled();
  });

  it('starts on the saved default model and effort', async () => {
    store.loadSetting.mockResolvedValue(
      JSON.stringify({ provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' }),
    );

    await askInChat({ question: 'where is auth?' });

    expect(store.createChat).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      provider: 'codex',
      model: 'gpt-5.6-sol',
    });
    expect(store.setChatModel).toHaveBeenCalledWith({
      chatId: 'chat-1',
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: 'high',
    });
  });

  it('prefers the value already in the store over a database read', async () => {
    store.settings = {
      [KEY]: JSON.stringify({ provider: 'codex', model: 'gpt-5.6-sol', effort: null }),
    };

    await askInChat({ question: 'where is auth?' });

    expect(store.loadSetting).not.toHaveBeenCalled();
    expect(store.createChat).toHaveBeenCalledWith(expect.objectContaining({ provider: 'codex' }));
  });

  it('still starts the chat when the default cannot be read', async () => {
    store.loadSetting.mockRejectedValue(new Error('db locked'));

    await askInChat({ question: 'where is auth?' });

    expect(store.createChat).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', model: 'sonnet-5' }),
    );
    expect(store.reportError).not.toHaveBeenCalled();
  });
});
