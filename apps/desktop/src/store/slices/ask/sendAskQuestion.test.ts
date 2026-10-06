// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

const { prompts, launch } = vi.hoisted(() => ({
  prompts: new Array<string>(),
  launch: {
    beforeInsert: null as null | (() => Promise<void>),
    whileStarting: null as null | (() => Promise<void>),
    beforeSetModel: null as null | (() => Promise<void>),
    isStarted: false,
    cancels: new Array<boolean>(),
  },
}));

vi.mock('../../../features/session/ask/activeAskBackend', async () => {
  const { createMemoryAskBackend } =
    await import('../../../features/session/ask/createMemoryAskBackend');
  const backend = createMemoryAskBackend({
    respond: async ({ request, onText, onStarted }) => {
      await launch.whileStarting?.();
      launch.isStarted = true;
      onStarted?.();
      prompts.push(request.prompt);
      onText('**Planner waits on [[Q1]].** [[A9]] is not real.');
      return { status: 'done' };
    },
  });
  return {
    activeAskBackend: {
      ...backend,
      insertMessage: async (params: Parameters<typeof backend.insertMessage>[0]) => {
        await launch.beforeInsert?.();
        return backend.insertMessage(params);
      },
      setThreadModel: async (params: Parameters<typeof backend.setThreadModel>[0]) => {
        await launch.beforeSetModel?.();
        return backend.setThreadModel(params);
      },
      cancelTurn: async (params: Parameters<typeof backend.cancelTurn>[0]) => {
        launch.cancels.push(launch.isStarted);
        return backend.cancelTurn(params);
      },
    },
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ChatId, IsoDateTime, OpenQuestionId, SessionId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import { askInitialState } from './state';

const SESSION = 'session-webhooks' as SessionId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  prompts.length = 0;
  launch.beforeInsert = null;
  launch.whileStarting = null;
  launch.beforeSetModel = null;
  launch.isStarted = false;
  launch.cancels.length = 0;
  useAppStore.setState({
    ...askInitialState,
    sessions: [aSession({ id: SESSION, goal: 'Fix webhook retries' })],
    currentSessionId: SESSION,
    sessionPhaseRuns: {
      [SESSION]: [anAgent({ id: 'agent-planner' as AgentId, sessionId: SESSION, name: 'Planner' })],
    },
    sessionOpenQuestions: {
      [SESSION]: [
        {
          id: 'q-1' as OpenQuestionId,
          sessionId: SESSION,
          createdByAgentId: 'agent-planner' as AgentId,
          text: 'Stop after 5 attempts, or keep backing off?',
          suggestedAnswers: [],
          isBlocking: true,
          userAnswer: null,
          status: 'open',
          createdAt: '2026-10-06T09:00:00.000Z' as IsoDateTime,
        },
      ],
    },
  });
});

afterEach(() => {
  prompts.length = 0;
});

const messagesOf = () => {
  const state = useAppStore.getState();
  const threadId = state.askThreadId[SESSION] ?? null;
  return threadId === null ? [] : (state.askMessages[threadId] ?? []);
};

describe('sendAskQuestion', () => {
  it('starts one thread for the session and saves chips that survive a reload', async () => {
    const isSent = await useAppStore.getState().sendAskQuestion({
      sessionId: SESSION,
      question: 'What needs me?',
      rightNow: ['$0.00 in this session'],
    });

    expect(isSent).toBe(true);
    const state = useAppStore.getState();
    expect(state.askThreads[SESSION]?.map((thread) => thread.title)).toEqual(['What needs me?']);
    const [question, reply] = messagesOf();
    expect(question?.content).toBe('What needs me?');
    expect(reply?.status).toBe('done');
    expect(reply?.content).toBe(
      '**Planner waits on [[question:q-1|Question 1]].** [[A9]] is not real.',
    );
    expect(state.askStreams).toEqual({});
    expect(prompts[0]).toContain('# Session: Fix webhook retries');
    expect(prompts[0]).toContain(
      '- [Q1] from Planner: Stop after 5 attempts, or keep backing off?',
    );
    expect(prompts[0]?.endsWith('New question:\nWhat needs me?')).toBe(true);
  });

  it('never launches the provider when Stop lands while the messages are saved', async () => {
    let release: () => void = () => undefined;
    launch.beforeInsert = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const sending = useAppStore.getState().sendAskQuestion({
      sessionId: SESSION,
      question: 'What needs me?',
      rightNow: [],
    });
    await vi.waitFor(() => expect(useAppStore.getState().askStreams).not.toEqual({}));
    await useAppStore.getState().stopAskReply({ sessionId: SESSION });
    launch.beforeInsert = null;
    release();

    expect(await sending).toBe(true);
    expect(prompts).toHaveLength(0);
    expect(messagesOf()[1]?.status).toBe('stopped');
    expect(useAppStore.getState().askStreams).toEqual({});
  });

  it('cancels right after the provider starts when Stop landed while it was starting', async () => {
    launch.whileStarting = () => useAppStore.getState().stopAskReply({ sessionId: SESSION });

    await useAppStore.getState().sendAskQuestion({
      sessionId: SESSION,
      question: 'What needs me?',
      rightNow: [],
    });

    expect(launch.cancels).toEqual([false, true]);
    expect(messagesOf()[1]?.status).toBe('stopped');
    expect(useAppStore.getState().askStreams).toEqual({});
  });

  it('keeps follow-ups in the same thread with the earlier turns in the prompt', async () => {
    const { sendAskQuestion } = useAppStore.getState();
    await sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });
    await sendAskQuestion({ sessionId: SESSION, question: 'And after that?', rightNow: [] });

    expect(useAppStore.getState().askThreads[SESSION]).toHaveLength(1);
    expect(messagesOf().map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
    expect(prompts[1]).toContain('Earlier in this chat:\nUser: What needs me?');
    expect(prompts[1]?.endsWith('New question:\nAnd after that?')).toBe(true);
  });

  it('starts a fresh thread after New and keeps the old one for Earlier', async () => {
    const state = useAppStore.getState();
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });
    state.newAskThread({ sessionId: SESSION });
    expect(messagesOf()).toEqual([]);
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What changed?', rightNow: [] });

    expect(useAppStore.getState().askThreads[SESSION]?.map((thread) => thread.title)).toEqual([
      'What changed?',
      'What needs me?',
    ]);
  });

  it('keeps the thread summary and the Earlier order current as questions are sent', async () => {
    const state = useAppStore.getState();
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });
    const firstId = useAppStore.getState().askThreadId[SESSION] ?? null;
    expect(useAppStore.getState().askThreads[SESSION]?.[0]?.messageCount).toBe(1);
    await state.sendAskQuestion({ sessionId: SESSION, question: 'And after that?', rightNow: [] });
    const askedAt = messagesOf()[2]?.createdAt;
    const afterFollowUp = useAppStore.getState().askThreads[SESSION]?.[0];
    expect(afterFollowUp?.messageCount).toBe(2);
    expect(afterFollowUp?.lastActivityAt).toBe(askedAt);

    state.newAskThread({ sessionId: SESSION });
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What changed?', rightNow: [] });
    expect(useAppStore.getState().askThreads[SESSION]?.map((thread) => thread.title)).toEqual([
      'What changed?',
      'What needs me?',
    ]);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await state.showAskThread({ sessionId: SESSION, threadId: firstId as ChatId });
    await state.sendAskQuestion({ sessionId: SESSION, question: 'One more?', rightNow: [] });
    const threads = useAppStore.getState().askThreads[SESSION] ?? [];
    expect(threads.map((thread) => [thread.title, thread.messageCount])).toEqual([
      ['What needs me?', 3],
      ['What changed?', 1],
    ]);
  });

  it('refuses New and a second question while a reply is streaming', async () => {
    const seen: Array<{ readonly isSent: boolean; readonly threadId: string | null }> = [];
    let streamingId: string | null = null;
    launch.whileStarting = async () => {
      streamingId = useAppStore.getState().askThreadId[SESSION] ?? null;
      useAppStore.getState().newAskThread({ sessionId: SESSION });
      const isSent = await useAppStore
        .getState()
        .sendAskQuestion({ sessionId: SESSION, question: 'Sneaky second?', rightNow: [] });
      seen.push({ isSent, threadId: useAppStore.getState().askThreadId[SESSION] ?? null });
    };
    await useAppStore
      .getState()
      .sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });

    expect(streamingId).not.toBeNull();
    expect(seen).toEqual([{ isSent: false, threadId: streamingId }]);
    expect(useAppStore.getState().askThreads[SESSION]).toHaveLength(1);
    expect(prompts).toHaveLength(1);
  });

  it('waits for the model choice to be saved before it launches the turn', async () => {
    const state = useAppStore.getState();
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });
    let release: () => void = () => undefined;
    launch.beforeSetModel = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    state.setAskRouting({
      sessionId: SESSION,
      routing: { provider: 'codex', model: 'gpt-6-astra', effort: 'high' },
    });
    const sending = state.sendAskQuestion({
      sessionId: SESSION,
      question: 'And after that?',
      rightNow: [],
    });
    await vi.waitFor(() => expect(messagesOf()).toHaveLength(4));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(prompts).toHaveLength(1);
    release();
    expect(await sending).toBe(true);
    expect(prompts).toHaveLength(2);
    expect(messagesOf()[3]?.status).toBe('done');
  });

  it('shows a failed model save inline and never launches the turn', async () => {
    const state = useAppStore.getState();
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });
    launch.beforeSetModel = async () => {
      throw new Error('database is locked');
    };
    state.setAskRouting({
      sessionId: SESSION,
      routing: { provider: 'codex', model: 'gpt-6-astra', effort: 'high' },
    });
    await state.sendAskQuestion({ sessionId: SESSION, question: 'And after that?', rightNow: [] });

    expect(prompts).toHaveLength(1);
    const reply = messagesOf()[3];
    expect(reply?.status).toBe('failed');
    expect(reply?.error).toContain('Could not save the model choice');
    expect(reply?.error).toContain('database is locked');
  });

  it('defaults to the chat line at low effort and refuses an empty question', async () => {
    const state = useAppStore.getState();
    expect(await state.sendAskQuestion({ sessionId: SESSION, question: '  ', rightNow: [] })).toBe(
      false,
    );
    await state.sendAskQuestion({ sessionId: SESSION, question: 'What needs me?', rightNow: [] });
    const thread = useAppStore.getState().askThreads[SESSION]?.[0];
    expect(thread?.provider).toBe('anthropic');
    expect(thread?.effort).toBe('low');
    expect(thread?.model).toMatch(/sonnet/);
  });
});
