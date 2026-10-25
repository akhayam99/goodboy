// @vitest-environment happy-dom

const { holder, control } = vi.hoisted(
  (): {
    holder: { backend: ChatBackend | null };
    control: {
      respond: null | ((params: ChatResponderParams) => Promise<ChatTurnOutcome>);
      insertFailure: null | Error;
      beforeInsert: null | (() => Promise<void>);
      beforeStart: null | (() => Promise<void>);
      launches: number;
      cancels: Array<boolean>;
      isStarted: boolean;
    };
  } => ({
    holder: { backend: null },
    control: {
      respond: null,
      insertFailure: null,
      beforeInsert: null,
      beforeStart: null,
      launches: 0,
      cancels: [],
      isStarted: false,
    },
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

beforeEach(async () => {
  await resetStoryStore();
  control.respond = null;
  control.insertFailure = null;
  control.beforeInsert = null;
  control.beforeStart = null;
  control.launches = 0;
  control.cancels.length = 0;
  control.isStarted = false;
  const memory = createMemoryChatBackend({
    respond: async (params) => {
      control.launches += 1;
      await control.beforeStart?.();
      control.isStarted = true;
      params.onStarted?.();
      const respond = control.respond;
      return respond === null ? { status: 'done' } : respond(params);
    },
  });
  holder.backend = {
    ...memory,
    insertMessage: async (params) => {
      await control.beforeInsert?.();
      if (control.insertFailure !== null) {
        throw control.insertFailure;
      }
      return memory.insertMessage(params);
    },
    cancelTurn: async (params) => {
      control.cancels.push(control.isStarted);
      return memory.cancelTurn(params);
    },
  };
});

const startChat = async (): Promise<ChatId> => {
  useAppStore.setState({ projects: [PAYMENTS], workspaces: [HARBORLINE] });
  const slice = useAppStore.getState();
  await slice.loadChats({ workspaceId: HARBORLINE.id });
  return slice.createChat({
    workspaceId: HARBORLINE.id,
    provider: 'anthropic',
    model: 'sonnet-5',
  });
};

const messagesOf = ({ chatId }: { readonly chatId: ChatId }) =>
  useAppStore.getState().chatMessages[chatId] ?? [];

type Gate = {
  readonly started: Promise<ChatResponderParams>;
  readonly release: (outcome?: ChatTurnOutcome) => void;
};

const gate = ({ text }: { readonly text: string }): Gate => {
  let open: (outcome: ChatTurnOutcome) => void = () => undefined;
  let report: (params: ChatResponderParams) => void = () => undefined;
  const opened = new Promise<ChatTurnOutcome>((resolve) => {
    open = resolve;
  });
  const started = new Promise<ChatResponderParams>((resolve) => {
    report = resolve;
  });
  control.respond = async (params) => {
    params.onText(text);
    report(params);
    return opened;
  };
  return { started, release: (outcome = { status: 'done' }) => open(outcome) };
};

describe('failure modes of one Chat turn', () => {
  it('F1 a provider failure fails the reply, keeps the partial text and the question', async () => {
    const chatId = await startChat();
    const pending = gate({ text: 'Retries double because ' });
    const sending = useAppStore.getState().sendChatMessage({ chatId, content: 'Why retries?' });
    await pending.started;

    pending.release({ status: 'failed', error: 'connection reset by peer' });
    await sending;

    const [question, reply] = messagesOf({ chatId });
    expect(question).toMatchObject({ role: 'user', content: 'Why retries?' });
    expect(reply).toMatchObject({
      status: 'failed',
      error: 'connection reset by peer',
      content: 'Retries double because ',
    });
    expect(useAppStore.getState().chatStreams).toEqual({});
  });

  it('F2 a save that throws fails the reply with the reason and never starts the provider', async () => {
    const chatId = await startChat();
    control.insertFailure = new Error('disk full');

    const isSent = await useAppStore
      .getState()
      .sendChatMessage({ chatId, content: 'Why retries?' });

    expect(isSent).toBe(true);
    expect(control.launches).toBe(0);
    expect(messagesOf({ chatId }).at(-1)).toMatchObject({ status: 'failed', error: 'disk full' });
    expect(useAppStore.getState().chatStreams).toEqual({});
  });

  it('F3 Stop mid-stream keeps the partial answer as stopped, with no error', async () => {
    const chatId = await startChat();
    const pending = gate({ text: 'Retries double because ' });
    const sending = useAppStore.getState().sendChatMessage({ chatId, content: 'Why retries?' });
    await pending.started;

    await useAppStore.getState().stopChatReply({ chatId });
    pending.release({ status: 'failed', error: 'killed' });
    await sending;

    expect(messagesOf({ chatId }).at(-1)).toMatchObject({
      status: 'stopped',
      content: 'Retries double because ',
      error: null,
    });
  });

  it('F4 Stop while the messages are saved never starts the provider', async () => {
    const chatId = await startChat();
    let release: () => void = () => undefined;
    control.beforeInsert = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const sending = useAppStore.getState().sendChatMessage({ chatId, content: 'Why retries?' });
    await vi.waitFor(() => expect(useAppStore.getState().chatStreams[chatId]).toBeDefined());

    await useAppStore.getState().stopChatReply({ chatId });
    control.beforeInsert = null;
    release();
    await sending;

    expect(control.launches).toBe(0);
    expect(messagesOf({ chatId }).at(-1)).toMatchObject({ status: 'stopped', error: null });
    expect(useAppStore.getState().chatStreams).toEqual({});
  });

  it('F5 Stop that lands while the provider is starting cancels it right after it started', async () => {
    const chatId = await startChat();
    let hold: () => void = () => undefined;
    control.beforeStart = () =>
      new Promise<void>((resolve) => {
        hold = resolve;
      });
    const sending = useAppStore.getState().sendChatMessage({ chatId, content: 'Why retries?' });
    await vi.waitFor(() => expect(control.launches).toBe(1));

    await useAppStore.getState().stopChatReply({ chatId });
    expect(control.cancels).toEqual([false]);
    hold();
    await sending;

    expect(control.cancels).toEqual([false, true]);
    expect(messagesOf({ chatId }).at(-1)).toMatchObject({ status: 'stopped', error: null });
  });

  it('F6 a second Stop cancels once', async () => {
    const chatId = await startChat();
    const pending = gate({ text: 'Retries double because ' });
    const sending = useAppStore.getState().sendChatMessage({ chatId, content: 'Why retries?' });
    await pending.started;

    await useAppStore.getState().stopChatReply({ chatId });
    await useAppStore.getState().stopChatReply({ chatId });
    pending.release();
    await sending;

    expect(control.cancels).toEqual([true]);
  });

  it('F7 a model change mid-turn leaves the running reply stamped with the model it used', async () => {
    const chatId = await startChat();
    const pending = gate({ text: 'Retries double because ' });
    const sending = useAppStore.getState().sendChatMessage({ chatId, content: 'Why retries?' });
    await pending.started;
    const before = messagesOf({ chatId }).at(-1);

    await useAppStore.getState().setChatModel({
      chatId,
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: 'high',
    });
    pending.release();
    await sending;

    const after = messagesOf({ chatId }).at(-1);
    expect(after?.provider).toBe(before?.provider);
    expect(after?.model).toBe(before?.model);
    expect(after?.provider).toBe('anthropic');
  });

  it('F8 a late delta from a finished turn does not touch its settled reply or the next one', async () => {
    const chatId = await startChat();
    let lateParams: ChatResponderParams | null = null;
    control.respond = async (params) => {
      lateParams = params;
      params.onText('First answer.');
      return { status: 'done' };
    };
    await useAppStore.getState().sendChatMessage({ chatId, content: 'First question?' });
    control.respond = async (params) => {
      params.onText('Second answer.');
      lateParams?.onText('LATE');
      lateParams?.onRead('payments-api/src/late.ts');
      return { status: 'done' };
    };

    await useAppStore.getState().sendChatMessage({ chatId, content: 'Second question?' });

    const replies = messagesOf({ chatId }).filter((message) => message.role === 'assistant');
    expect(replies.map((reply) => reply.content)).toEqual(['First answer.', 'Second answer.']);
    expect(replies[0]?.reads).toEqual([]);
  });
});
