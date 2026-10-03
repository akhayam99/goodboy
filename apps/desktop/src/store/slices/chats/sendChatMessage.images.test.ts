// @vitest-environment happy-dom

const { holder } = vi.hoisted(() => ({
  holder: { backend: null as ChatBackend | null },
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/workspace-chat/activeChatBackend', () => ({
  activeChatBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatId } from '@goodboy/types';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import type { ChatBackend } from '../../../features/workspace-chat/chatBackend';
import type { ChatTurnRequest } from '../../../features/workspace-chat/runChatTurn';
import { createMemoryChatBackend } from '../../../features/workspace-chat/createMemoryChatBackend';
import type { PendingAttachment } from '../../../features/attachments/pendingAttachment';
import { SETTING_CHAT_IMAGES } from '../../../features/settings/settings';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const HARBORLINE = aWorkspace({ name: 'Harborline' });
const PAYMENTS = aProject({
  workspaceId: HARBORLINE.id,
  name: 'payments-api',
  rootPath: '/Users/mara/code/harborline/payments-api',
});
const WORKSPACE = HARBORLINE.id;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type HarnessParams = {
  readonly settings?: Readonly<Record<string, string>>;
};

const harness = ({ settings = {} }: HarnessParams = {}) => {
  useAppStore.setState({
    projects: [PAYMENTS],
    workspaces: [HARBORLINE],
    settings: { ...useAppStore.getState().settings, ...settings },
  });
  return { slice: useAppStore.getState(), read: () => useAppStore.getState() };
};

const screenshot = (name: string): PendingAttachment => ({
  id: crypto.randomUUID(),
  fileName: name,
  mimeType: 'image/png',
  blob: new Blob([new Uint8Array([137, 80, 78, 71, name.length])], { type: 'image/png' }),
  relPath: null,
});

let requests: ChatTurnRequest[] = [];

const newBackend = (): ChatBackend =>
  createMemoryChatBackend({
    respond: async (params) => {
      requests.push(params.request);
      params.onText('The 502 comes from notify-relay.');
      return { status: 'done' };
    },
  });

const startChat = async ({ slice }: Pick<ReturnType<typeof harness>, 'slice'>): Promise<ChatId> => {
  await slice.loadChats({ workspaceId: WORKSPACE });
  return slice.createChat({ workspaceId: WORKSPACE, provider: 'anthropic', model: 'sonnet-5' });
};

beforeEach(async () => {
  await resetStoryStore();
  requests = [];
  holder.backend = newBackend();
});

describe('chat images', () => {
  it('saves the images with the message and reads them back after a reload', async () => {
    const { slice, read } = harness();
    const chatId = await startChat({ slice });
    const trace = screenshot('acme-trace.png');

    expect(
      await slice.sendChatMessage({ chatId, content: '', attachments: [trace, screenshot('x')] }),
    ).toBe(true);

    const [asked] = read().chatMessages[chatId] ?? [];
    expect(asked?.content).toBe('');
    expect(asked?.attachments.map((image) => [image.position, image.fileName])).toEqual([
      [0, 'acme-trace.png'],
      [1, 'x.png'],
    ]);
    expect(requests[0]?.images).toEqual({ messageId: asked?.id });
    expect(requests[0]?.prompt).toBe('Look at the attached images.');

    useAppStore.setState({ chatMessages: {} });
    await read().loadChatMessages({ chatId });
    const [again] = read().chatMessages[chatId] ?? [];
    expect(again?.attachments).toEqual(asked?.attachments);
    const first = again?.attachments[0];
    if (first === undefined || holder.backend === null) {
      throw new Error('no image after the reload');
    }
    const blob = await holder.backend.readImage({ chatId, attachmentId: first.id });
    expect(blob.size).toBe(trace.blob.size);
  });

  it('keeps the earlier images readable when the next question has none', async () => {
    const { slice, read } = harness();
    const chatId = await startChat({ slice });
    await slice.sendChatMessage({
      chatId,
      content: 'What fails here?',
      attachments: [screenshot('a.png')],
    });
    await slice.sendChatMessage({ chatId, content: 'And on Northwind?' });

    const asked = (read().chatMessages[chatId] ?? []).filter((message) => message.role === 'user');
    expect(requests.map((request) => request.images)).toEqual([
      { messageId: asked[0]?.id },
      { messageId: asked[1]?.id },
    ]);
    expect(requests[1]?.prompt).toContain('User: What fails here? (attached images: a.png)');
  });

  it('sends no image and asks for none when the switch is off', async () => {
    const { slice, read } = harness({ settings: { [SETTING_CHAT_IMAGES]: 'false' } });
    const chatId = await startChat({ slice });

    expect(
      await slice.sendChatMessage({ chatId, content: '', attachments: [screenshot('a.png')] }),
    ).toBe(false);
    expect(read().chatMessages[chatId] ?? []).toEqual([]);

    await slice.sendChatMessage({
      chatId,
      content: 'Why 502?',
      attachments: [screenshot('a.png')],
    });
    const [asked] = read().chatMessages[chatId] ?? [];
    expect(asked?.attachments).toEqual([]);
    expect(requests[0]?.images).toBeUndefined();
  });

  it('sends nothing when an image cannot be saved', async () => {
    const backend = newBackend();
    holder.backend = {
      ...backend,
      writeImage: async () => {
        throw new Error('disk full');
      },
    };
    const { slice, read } = harness();
    const chatId = await startChat({ slice });

    expect(
      await slice.sendChatMessage({
        chatId,
        content: 'Why 502?',
        attachments: [screenshot('a.png')],
      }),
    ).toBe(false);
    expect(read().chatMessages[chatId] ?? []).toEqual([]);
    expect(await backend.listMessages({ chatId })).toEqual([]);
    expect(requests).toEqual([]);
  });
});
