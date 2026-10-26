import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { activeChatBackend, registerChatBackend } from './activeChatBackend';
import { createMemoryChatBackend } from '../../test/createMemoryChatBackend';
import { mockChatResponder } from '../../app/components/MockScene/backends/chat/mockChatResponder';
import { mockChatSeed } from '../../app/components/MockScene/backends/chat/mockChatSeed';
import { mockWorkSummarizer } from '../../app/components/MockScene/backends/chat/mockWorkSummarizer';
import { tauriChatBackend } from './tauriChatBackend';

const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });

const memoryBackend = () =>
  createMemoryChatBackend({
    respond: mockChatResponder,
    seed: mockChatSeed,
    summarize: mockWorkSummarizer,
  });

describe('the active chat backend', () => {
  afterEach(() => {
    registerChatBackend({ backend: tauriChatBackend });
  });

  it('answers through the backend that was registered last', async () => {
    const listChats = vi.fn(async () => []);
    registerChatBackend({ backend: { ...memoryBackend(), listChats } });

    await activeChatBackend.listChats({ workspaceId });

    expect(listChats).toHaveBeenCalledWith({ workspaceId });
  });

  it('switches to a later registration without a new import', async () => {
    const first = vi.fn(async () => []);
    const second = vi.fn(async () => []);
    registerChatBackend({ backend: { ...memoryBackend(), listChats: first } });
    registerChatBackend({ backend: { ...memoryBackend(), listChats: second } });

    await activeChatBackend.listChats({ workspaceId });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
