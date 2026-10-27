// @vitest-environment happy-dom

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

const { control } = vi.hoisted(
  (): {
    control: {
      respond: null | ((params: AskResponderParams) => Promise<ChatTurnOutcome>);
      insertFailure: null | Error;
      launches: number;
      cancels: Array<boolean>;
      isStarted: boolean;
    };
  } => ({
    control: { respond: null, insertFailure: null, launches: 0, cancels: [], isStarted: false },
  }),
);

vi.mock('../../../features/session/ask/activeAskBackend', async () => {
  const { createMemoryAskBackend } = await import('../../../test/createMemoryAskBackend');
  const backend = createMemoryAskBackend({
    respond: async (params) => {
      control.launches += 1;
      const respond = control.respond;
      return respond === null ? { status: 'done' } : respond(params);
    },
  });
  return {
    activeAskBackend: {
      ...backend,
      insertMessage: async (params: Parameters<typeof backend.insertMessage>[0]) => {
        if (control.insertFailure !== null) {
          throw control.insertFailure;
        }
        return backend.insertMessage(params);
      },
      cancelTurn: async (params: Parameters<typeof backend.cancelTurn>[0]) => {
        control.cancels.push(control.isStarted);
        return backend.cancelTurn(params);
      },
    },
  };
});

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { ChatTurnOutcome } from '../../../features/conversation/chatTurnOutcome';
import type { AskResponder } from '../../../test/createMemoryAskBackend';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { askInitialState } from './state';

type AskResponderParams = Parameters<AskResponder>[0];

const SESSION = brandId<SessionId>({ value: 'session-webhooks' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  control.respond = null;
  control.insertFailure = null;
  control.launches = 0;
  control.cancels.length = 0;
  control.isStarted = false;
  useAppStore.setState({
    ...askInitialState,
    sessions: [aSession({ id: SESSION, goal: 'Fix webhook retries' })],
    currentSessionId: SESSION,
  });
});

type Gate = {
  readonly started: Promise<AskResponderParams>;
  readonly release: (outcome?: ChatTurnOutcome) => void;
};

const gate = ({ text }: { readonly text: string }): Gate => {
  let open: (outcome: ChatTurnOutcome) => void = () => undefined;
  let report: (params: AskResponderParams) => void = () => undefined;
  const opened = new Promise<ChatTurnOutcome>((resolve) => {
    open = resolve;
  });
  const started = new Promise<AskResponderParams>((resolve) => {
    report = resolve;
  });
  control.respond = async (params) => {
    control.isStarted = true;
    params.onStarted?.();
    params.onText(text);
    report(params);
    return opened;
  };
  return { started, release: (outcome = { status: 'done' }) => open(outcome) };
};

const ask = (question: string) =>
  useAppStore.getState().sendAskQuestion({ sessionId: SESSION, question, rightNow: [] });

const messagesOf = () => {
  const state = useAppStore.getState();
  const threadId = state.askThreadId[SESSION] ?? null;
  return threadId === null ? [] : (state.askMessages[threadId] ?? []);
};

describe('failure modes of one Ask turn', () => {
  it('F1 a provider failure fails the reply, keeps the partial text and the question', async () => {
    const pending = gate({ text: 'Retries double because ' });
    const sending = ask('Why do retries double?');
    await pending.started;

    pending.release({ status: 'failed', error: 'connection reset by peer' });
    await sending;

    const [question, reply] = messagesOf();
    expect(question).toMatchObject({ role: 'user', content: 'Why do retries double?' });
    expect(reply).toMatchObject({
      status: 'failed',
      error: 'connection reset by peer',
      content: 'Retries double because ',
    });
    expect(useAppStore.getState().askStreams).toEqual({});
  });

  it('F2 a save that throws fails the reply with the reason and never starts the provider', async () => {
    control.insertFailure = new Error('disk full');

    const isSent = await ask('Why do retries double?');

    expect(isSent).toBe(true);
    expect(control.launches).toBe(0);
    expect(messagesOf().at(-1)).toMatchObject({ status: 'failed', error: 'disk full' });
    expect(useAppStore.getState().askStreams).toEqual({});
  });

  it('F3 Stop mid-stream keeps the partial answer as stopped, with no error', async () => {
    const pending = gate({ text: 'Retries double because ' });
    const sending = ask('Why do retries double?');
    await pending.started;

    await useAppStore.getState().stopAskReply({ sessionId: SESSION });
    pending.release({ status: 'failed', error: 'killed' });
    await sending;

    expect(messagesOf().at(-1)).toMatchObject({
      status: 'stopped',
      content: 'Retries double because ',
      error: null,
    });
  });

  it('F6 a second Stop cancels once', async () => {
    const pending = gate({ text: 'Retries double because ' });
    const sending = ask('Why do retries double?');
    await pending.started;

    await useAppStore.getState().stopAskReply({ sessionId: SESSION });
    await useAppStore.getState().stopAskReply({ sessionId: SESSION });
    pending.release();
    await sending;

    expect(control.cancels).toEqual([true]);
  });

  it('F7 a model change mid-turn leaves the running reply stamped with the model it used', async () => {
    const pending = gate({ text: 'Retries double because ' });
    const sending = ask('Why do retries double?');
    await pending.started;
    const before = messagesOf().at(-1);

    useAppStore.getState().setAskRouting({
      sessionId: SESSION,
      routing: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
    });
    pending.release();
    await sending;

    const after = messagesOf().at(-1);
    expect(after?.provider).toBe(before?.provider);
    expect(after?.model).toBe(before?.model);
    expect(after?.provider).not.toBe('codex');
    expect(useAppStore.getState().askRouting[SESSION]?.provider).toBe('codex');
  });

  it('F8 a late delta from a finished turn does not touch its settled reply or the next one', async () => {
    let lateParams: AskResponderParams | null = null;
    control.respond = async (params) => {
      lateParams = params;
      params.onText('First answer.');
      return { status: 'done' };
    };
    await ask('First question?');
    const first = messagesOf().at(-1);
    control.respond = async (params) => {
      params.onText('Second answer.');
      lateParams?.onText('LATE');
      lateParams?.onRead('payments-api/src/late.ts');
      return { status: 'done' };
    };

    await ask('Second question?');

    const replies = messagesOf().filter((message) => message.role === 'assistant');
    expect(replies.map((reply) => reply.content)).toEqual(['First answer.', 'Second answer.']);
    expect(replies[0]?.reads).toEqual([]);
    expect(first?.content).toBe('First answer.');
  });
});
