// @vitest-environment happy-dom

const { holder, control } = vi.hoisted(
  (): {
    holder: { backend: ChatBackend | null };
    control: {
      respond: null | ((params: ChatResponderParams) => Promise<ChatTurnOutcome>);
    };
  } => ({
    holder: { backend: null },
    control: { respond: null },
  }),
);

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
import type { ChatTurnOutcome } from '../../../features/conversation/chatTurnOutcome';
import type { ChatBackend } from '../../../features/workspace-chat/chatBackend';
import {
  createMemoryChatBackend,
  type ChatResponderParams,
} from '../../../test/createMemoryChatBackend';
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

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type Hold = {
  readonly chatId: ChatId;
  readonly release: (outcome?: ChatTurnOutcome) => void;
};

const holds: Array<Hold> = [];

beforeEach(async () => {
  await resetStoryStore();
  control.respond = null;
  holds.length = 0;
  holder.backend = createMemoryChatBackend({
    respond: async (params) => {
      params.onStarted?.();
      const respond = control.respond;
      return respond === null ? { status: 'done' } : respond(params);
    },
  });
});

const holdTurns = (): void => {
  control.respond = (params) =>
    new Promise<ChatTurnOutcome>((resolve) => {
      holds.push({
        chatId: params.request.chatId,
        release: (outcome = { status: 'done' }) => resolve(outcome),
      });
    });
};

const holdOf = ({ chatId }: { readonly chatId: ChatId }): Hold => {
  const hold = holds.find((candidate) => candidate.chatId === chatId);
  if (hold === undefined) {
    throw new Error('no turn is waiting in this chat');
  }
  holds.splice(holds.indexOf(hold), 1);
  return hold;
};

const startChat = async (): Promise<ChatId> => {
  useAppStore.setState({ projects: [PAYMENTS], workspaces: [HARBORLINE] });
  const slice = useAppStore.getState();
  await slice.loadChats({ workspaceId: HARBORLINE.id });
  return slice.createChat({ workspaceId: HARBORLINE.id, provider: 'anthropic', model: 'sonnet-5' });
};

const read = () => useAppStore.getState();

const askedIn = ({ chatId }: { readonly chatId: ChatId }): ReadonlyArray<string> =>
  (read().chatMessages[chatId] ?? [])
    .filter((message) => message.role === 'user')
    .map((message) => message.content);

const queuedIn = ({ chatId }: { readonly chatId: ChatId }): ReadonlyArray<string> =>
  (read().chatQueues[chatId] ?? []).map((turn) => turn.content);

const settle = async ({ chatId }: { readonly chatId: ChatId }): Promise<void> => {
  await vi.waitFor(() => expect(read().chatStreams[chatId]).toBeUndefined());
};

type Turn = {
  readonly done: Promise<boolean>;
};

const startTurn = async ({ chatId }: { readonly chatId: ChatId }): Promise<Turn> => {
  holdTurns();
  const done = read().submitChatMessage({ chatId, content: 'one', attachments: [] });
  await vi.waitFor(() => expect(holds.some((hold) => hold.chatId === chatId)).toBe(true));
  return { done };
};

describe('the Chat queue', () => {
  it('queues a message typed while an answer streams and starts no second turn', async () => {
    const chatId = await startChat();
    const first = await startTurn({ chatId });

    const isQueued = await read().submitChatMessage({
      chatId,
      content: '  and notify-relay?  ',
      attachments: [],
    });

    expect(isQueued).toBe(true);
    expect(queuedIn({ chatId })).toEqual(['and notify-relay?']);
    expect(read().chatQueues[chatId]?.[0]?.status).toBe('queued');
    expect(holds).toHaveLength(1);
    holdOf({ chatId }).release();
    await first.done;
  });

  it('ignores an empty message and sends straight away when nothing is running', async () => {
    const chatId = await startChat();

    expect(read().enqueueChatMessage({ chatId, content: '   ', attachments: [] })).toBe(false);
    expect(read().chatQueues).toEqual({});

    const isSent = await read().submitChatMessage({ chatId, content: 'one', attachments: [] });

    expect(isSent).toBe(true);
    expect(askedIn({ chatId })).toEqual(['one']);
    expect(read().chatQueues).toEqual({});
  });

  it('sends the queued messages in order when the answer ends', async () => {
    const chatId = await startChat();
    const first = await startTurn({ chatId });
    await read().submitChatMessage({ chatId, content: 'two', attachments: [] });
    await read().submitChatMessage({ chatId, content: 'three', attachments: [] });

    holdOf({ chatId }).release();
    await first.done;
    await vi.waitFor(() => expect(holds).toHaveLength(1));
    expect(askedIn({ chatId })).toEqual(['one', 'two']);
    expect(queuedIn({ chatId })).toEqual(['three']);

    holdOf({ chatId }).release();
    await vi.waitFor(() => expect(holds).toHaveLength(1));
    expect(askedIn({ chatId })).toEqual(['one', 'two', 'three']);
    expect(queuedIn({ chatId })).toEqual([]);

    holdOf({ chatId }).release();
    await settle({ chatId });
    expect(read().chatQueues).toEqual({});
  });

  it('drops a removed message and hands an edited one back without sending it', async () => {
    const chatId = await startChat();
    const first = await startTurn({ chatId });
    read().enqueueChatMessage({ chatId, content: 'two', attachments: [] });
    read().enqueueChatMessage({ chatId, content: 'three', attachments: [] });
    read().enqueueChatMessage({ chatId, content: 'four', attachments: [] });
    const [two, three] = read().chatQueues[chatId] ?? [];

    read().removeQueuedChatMessage({ chatId, itemId: two?.id ?? '' });
    const taken = read().takeQueuedChatMessage({ chatId, itemId: three?.id ?? '' });

    expect(taken?.content).toBe('three');
    expect(queuedIn({ chatId })).toEqual(['four']);
    holdOf({ chatId }).release();
    await first.done;
    await vi.waitFor(() => expect(holds).toHaveLength(1));
    expect(askedIn({ chatId })).toEqual(['one', 'four']);
    holdOf({ chatId }).release();
    await settle({ chatId });
  });

  it('keeps the queue when you press Stop, and sends it after your next reply', async () => {
    const chatId = await startChat();
    const first = await startTurn({ chatId });
    read().enqueueChatMessage({ chatId, content: 'two', attachments: [] });

    await read().stopChatReply({ chatId });
    holdOf({ chatId }).release({ status: 'failed', error: 'killed' });
    await first.done;

    expect(holds).toHaveLength(0);
    expect(read().chatMessages[chatId]?.at(-1)).toMatchObject({ status: 'stopped' });
    expect(queuedIn({ chatId })).toEqual(['two']);
    expect(read().chatQueues[chatId]?.[0]?.status).toBe('queued');

    const next = await startTurn({ chatId });
    holdOf({ chatId }).release();
    await next.done;
    await vi.waitFor(() => expect(holds).toHaveLength(1));
    expect(askedIn({ chatId })).toEqual(['one', 'one', 'two']);
    holdOf({ chatId }).release();
    await settle({ chatId });
  });

  it('sends a stopped queue at once from Send now', async () => {
    const chatId = await startChat();
    const first = await startTurn({ chatId });
    read().enqueueChatMessage({ chatId, content: 'two', attachments: [] });
    await read().stopChatReply({ chatId });
    holdOf({ chatId }).release();
    await first.done;

    holdTurns();
    void read().drainChatQueue({ chatId });
    await vi.waitFor(() => expect(holds).toHaveLength(1));

    expect(askedIn({ chatId })).toEqual(['one', 'two']);
    holdOf({ chatId }).release();
    await settle({ chatId });
  });

  it('keeps a message that could not be sent, shows why, and sends it on Retry', async () => {
    const chatId = await startChat();
    const first = await startTurn({ chatId });
    read().enqueueChatMessage({ chatId, content: 'two', attachments: [] });
    const real = read().sendChatMessage;
    useAppStore.setState({ sendChatMessage: async () => false });

    holdOf({ chatId }).release();
    await first.done;
    await vi.waitFor(() => expect(read().chatQueues[chatId]?.[0]?.status).toBe('failed'));

    const [held] = read().chatQueues[chatId] ?? [];
    expect(held?.content).toBe('two');
    expect(held?.failure).toBe('The message was not delivered. It is still in the queue.');
    expect(askedIn({ chatId })).toEqual(['one']);

    useAppStore.setState({ sendChatMessage: real });
    holdTurns();
    void read().retryQueuedChatMessage({ chatId, itemId: held?.id ?? '' });
    await vi.waitFor(() => expect(holds).toHaveLength(1));
    expect(askedIn({ chatId })).toEqual(['one', 'two']);
    expect(queuedIn({ chatId })).toEqual([]);
    holdOf({ chatId }).release();
    await settle({ chatId });
  });

  it('keeps a message whose send threw, with the reason', async () => {
    const chatId = await startChat();
    const first = await startTurn({ chatId });
    read().enqueueChatMessage({ chatId, content: 'two', attachments: [] });
    useAppStore.setState({
      sendChatMessage: async () => {
        throw new Error('disk full');
      },
    });

    holdOf({ chatId }).release();
    await first.done;
    await vi.waitFor(() => expect(read().chatQueues[chatId]?.[0]?.status).toBe('failed'));

    expect(read().chatQueues[chatId]?.[0]).toMatchObject({ content: 'two', failure: 'disk full' });
  });

  it('keeps each chat queue apart, and a late answer flushes only its own chat', async () => {
    const chatA = await startChat();
    const chatB = await startChat();
    const firstA = await startTurn({ chatId: chatA });
    const firstB = await startTurn({ chatId: chatB });
    read().enqueueChatMessage({ chatId: chatA, content: 'two for A', attachments: [] });
    read().enqueueChatMessage({ chatId: chatB, content: 'two for B', attachments: [] });

    holdOf({ chatId: chatA }).release();
    await firstA.done;
    await vi.waitFor(() => expect(holds.some((hold) => hold.chatId === chatA)).toBe(true));

    expect(askedIn({ chatId: chatA })).toEqual(['one', 'two for A']);
    expect(askedIn({ chatId: chatB })).toEqual(['one']);
    expect(queuedIn({ chatId: chatB })).toEqual(['two for B']);

    holdOf({ chatId: chatA }).release();
    holdOf({ chatId: chatB }).release();
    await firstB.done;
    await vi.waitFor(() => expect(holds.some((hold) => hold.chatId === chatB)).toBe(true));
    expect(askedIn({ chatId: chatB })).toEqual(['one', 'two for B']);
    holdOf({ chatId: chatB }).release();
    await settle({ chatId: chatA });
    await settle({ chatId: chatB });
  });

  it('forgets the queue of a chat you delete', async () => {
    const chatId = await startChat();
    const first = await startTurn({ chatId });
    read().enqueueChatMessage({ chatId, content: 'two', attachments: [] });

    const deleting = read().deleteChats({ workspaceId: HARBORLINE.id, chatIds: [chatId] });
    holdOf({ chatId }).release({ status: 'failed', error: 'killed' });
    await deleting;
    await first.done;

    expect(read().chatQueues).toEqual({});
  });
});
